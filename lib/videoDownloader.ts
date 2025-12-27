// Biblioteca para baixar vídeos de diferentes plataformas
import { VideoMetadata } from '@/types/recipe';

type DownloadResult = {
  audioUrl?: string;
  audioPath?: string;
  cleanup: () => Promise<void>;
  thumbnailUrl?: string;
  thumbnailSource?: string;
  metadata?: VideoMetadata | null;
  audioSource?: 'tiktok-video' | 'tiktok-music' | 'youtube' | 'instagram' | 'other';
};

let ytDlpBinaryPathPromise: Promise<string> | null = null;

type TikTokOEmbed = {
  title?: string;
  author_name?: string;
};

async function fetchTikTokOEmbed(url: string): Promise<TikTokOEmbed | null> {
  try {
    const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('[BelchiorReceitas] Falha ao buscar oEmbed do TikTok:', (error as any)?.message);
    return null;
  }
}

async function resolveYtDlpBinaryPath(): Promise<string> {
  const envPath = process.env.YTDLP_PATH;
  if (envPath) return envPath;

  if (!ytDlpBinaryPathPromise) {
    ytDlpBinaryPathPromise = (async () => {
      const { tmpdir } = await import('os');
      const { join } = await import('path');
      const { access, stat } = await import('fs/promises');

      const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
      const binaryPath = join(tmpdir(), binaryName);

      try {
        await access(binaryPath);
        const fileStat = await stat(binaryPath);
        if (fileStat.size > 0) {
          return binaryPath;
        }
      } catch {
        // Binary not available yet.
      }

      console.log('[BelchiorReceitas] yt-dlp não encontrado no runtime; baixando binário...');
      const { default: YTDlpWrap } = await import('yt-dlp-wrap');
      await YTDlpWrap.downloadFromGithub(binaryPath);
      return binaryPath;
    })();

    ytDlpBinaryPathPromise.catch(() => {
      ytDlpBinaryPathPromise = null;
    });
  }

  return ytDlpBinaryPathPromise;
}

async function createYtDlpWrap() {
  const { default: YTDlpWrap } = await import('yt-dlp-wrap');
  const binaryPath = await resolveYtDlpBinaryPath();
  return new YTDlpWrap(binaryPath);
}

// Extrair metadados do vídeo (descrição, título, etc)
export async function extractVideoMetadata(url: string): Promise<VideoMetadata | null> {
  try {
    console.log('[BelchiorReceitas] Extraindo metadados do vídeo...');
    const ytDlpWrap = await createYtDlpWrap();
    
    const metadataJson = await ytDlpWrap.execPromise([
      url,
      '--dump-json',
      '--no-warnings',
      '--skip-download',
      '--socket-timeout', '30',
    ]);
    
    const metadata = JSON.parse(metadataJson);
    
    const thumbnailsArray: string[] = Array.isArray(metadata.thumbnails)
      ? metadata.thumbnails
          .map((t: any) => t?.url)
          .filter((u: string | undefined): u is string => !!u)
      : [];

    const bestThumbnail =
      thumbnailsArray.length > 0
        ? thumbnailsArray[thumbnailsArray.length - 1] // yt-dlp usually orders smallest->largest
        : metadata.thumbnail || '';

    const result: VideoMetadata = {
      title: metadata.title || metadata.fulltitle || '',
      description: metadata.description || '',
      hashtags: metadata.tags || [],
      duration: metadata.duration || 0,
      platform: url.includes('youtube') || url.includes('youtu.be') ? 'youtube' as const :
                url.includes('tiktok') ? 'tiktok' as const :
                url.includes('instagram') ? 'instagram' as const : undefined,
      thumbnailUrl: bestThumbnail || undefined,
      thumbnails: thumbnailsArray,
    };
    
    console.log('[BelchiorReceitas] ✅ Metadados extraídos:', {
      title: result.title?.substring(0, 50) + '...',
      hasDescription: !!result.description,
      descriptionLength: result.description?.length || 0,
    });
    
    return result;
  } catch (error: any) {
    console.warn('[BelchiorReceitas] ⚠️ Erro ao extrair metadados:', error?.message?.substring(0, 100));
    return null;
  }
}

export async function downloadVideoViaAPI(url: string): Promise<DownloadResult & { metadata: VideoMetadata | null }> {
  const { join } = await import('path');
  const { tmpdir } = await import('os');

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const audioPath = join(tmpdir(), `belchior-${generateId()}.mp3`);

  console.log('[BelchiorReceitas] Detectando plataforma...');

  // Detectar plataforma
  const isTikTok = url.includes('tiktok.com') || url.includes('vm.tiktok') || url.includes('vt.tiktok');
  const isInstagram = url.includes('instagram.com');
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const detectedPlatform = isYouTube ? 'youtube' : isTikTok ? 'tiktok' : isInstagram ? 'instagram' : undefined;

  // PASSO 1: Extrair metadados (descrição, título)
  const allowYtDlpMetadata = process.env.ENABLE_YTDLP_METADATA === '1';
  const metadataFromYtDlp = (isYouTube || allowYtDlpMetadata) ? await extractVideoMetadata(url) : null;

  const metadataPlatform = metadataFromYtDlp?.platform || detectedPlatform;
  let thumbnailUrl = metadataFromYtDlp?.thumbnailUrl;
  let thumbnailSource = metadataFromYtDlp?.thumbnailUrl
    ? (metadataPlatform === 'tiktok' ? 'tiktok-cover'
      : metadataPlatform === 'instagram' ? 'ig-thumb'
      : 'yt-thumb')
    : undefined;

  // PASSO 2: Baixar áudio
  let result: DownloadResult;
  if (isYouTube) {
    // YouTube usa yt-dlp (com arquivo local)
    result = await downloadWithYtDlp(url, audioPath);
    result.audioSource = 'youtube';
  } else if (isTikTok) {
    // TikTok usa API - retorna URL direto (sem arquivo local)
    result = await downloadTikTokViaAPI(url);
  } else if (isInstagram) {
    // Instagram usa API - retorna URL direto (sem arquivo local)
    result = await downloadInstagramViaAPI(url);
    result.audioSource = 'instagram';
  } else {
    // Fallback: tentar com yt-dlp
    result = await downloadWithYtDlp(url, audioPath);
    result.audioSource = 'other';
  }

  // Consolidar thumbnail se veio do download específico
  thumbnailUrl = result.thumbnailUrl || thumbnailUrl;
  thumbnailSource = result.thumbnailSource || thumbnailSource;

  const metadataFromApi = result.metadata;
  const mergedMetadata = metadataFromYtDlp
    ? { ...metadataFromApi, ...metadataFromYtDlp }
    : metadataFromApi || null;

  let finalMetadata = mergedMetadata ? { ...mergedMetadata } : null;

  if (detectedPlatform === 'tiktok' && !finalMetadata?.description) {
    const oembed = await fetchTikTokOEmbed(url);
    const oembedTitle = oembed?.title?.trim();
    if (oembedTitle) {
      finalMetadata = {
        ...(finalMetadata || { platform: 'tiktok' as const }),
        title: finalMetadata?.title || oembedTitle,
        description: oembedTitle,
      };
    }
  }

  if (finalMetadata && !finalMetadata.platform && detectedPlatform) {
    finalMetadata.platform = detectedPlatform;
  }

  // Retornar áudio + metadados
  return {
    ...result,
    thumbnailUrl,
    thumbnailSource,
    metadata: finalMetadata,
  };
}

// Download com yt-dlp (YouTube)
async function downloadWithYtDlp(url: string, audioPath: string): Promise<DownloadResult> {
  console.log('[BelchiorReceitas] Usando yt-dlp para YouTube...');
  
  const ytDlpWrap = await createYtDlpWrap();
  
  try {
    await ytDlpWrap.execPromise([
      url,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '5',
      '-o', audioPath,
      '--no-playlist',
      '--max-filesize', '50m',
      '--no-warnings',
      '--no-check-certificates',
      '--prefer-free-formats',
      '--socket-timeout', '30',
      '--retries', '5',
    ]);
    
    console.log('[BelchiorReceitas] ✅ YouTube baixado com sucesso');
    
  } catch (error: any) {
    console.error('[BelchiorReceitas] Erro no yt-dlp:', error?.message);
    throw new Error(`YouTube: ${error?.message || 'Falha ao baixar'}. Verifique se a URL é válida e o vídeo é público.`);
  }
  
  const { unlink } = await import('fs/promises');
  return {
    audioPath,
    cleanup: async () => {
      await unlink(audioPath).catch(() => {});
    }
  };
}

// Download TikTok via API - Retorna URL do vídeo (sem arquivo local)
async function downloadTikTokViaAPI(url: string): Promise<DownloadResult> {
  console.log('[BelchiorReceitas] Obtendo URL do vídeo TikTok via API...');

  // Usar APIs para obter URL do vídeo
  const apis = [
    // API 1: TikWM
    async () => {
      console.log('[BelchiorReceitas] Tentando TikWM...');
      const response = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({ url, hd: 1 }),
      });
      const data = await response.json();

      console.log('[BelchiorReceitas] TikWM response:', data.code);

      if (data.code === 0 && data.data) {
        const audioUrl =
          data.data.music ||
          data.data.music_url ||
          data.data.music_info?.play ||
          data.data.music_info?.play_url?.[0] ||
          data.data.music_info?.playUrl;
        const videoUrl = data.data.play || data.data.wmplay || data.data.hdplay;
        const preferMusic = process.env.TIKTOK_PREFER_MUSIC_AUDIO === '1';
        const mediaUrl = preferMusic ? (audioUrl || videoUrl) : (videoUrl || audioUrl);
        const audioSource: 'tiktok-video' | 'tiktok-music' | undefined = mediaUrl
          ? (mediaUrl === videoUrl ? 'tiktok-video' : 'tiktok-music')
          : undefined;
        const cover = data.data.cover || data.data.origin_cover;
        const description = data.data.title || data.data.desc;
        const duration = typeof data.data.duration === 'number' ? data.data.duration : undefined;
        const metadata: VideoMetadata | undefined = data.data
          ? {
              platform: 'tiktok',
              ...(description ? { title: description, description } : {}),
              ...(typeof duration === 'number' ? { duration } : {}),
              ...(cover ? { thumbnailUrl: cover } : {}),
            }
          : undefined;
        if (mediaUrl) {
          console.log(
            `[BelchiorReceitas] ✅ TikWM: URL de ${audioSource === 'tiktok-video' ? 'vídeo' : 'áudio'} obtida`
          );
          return {
            videoUrl: mediaUrl,
            thumbnailUrl: cover,
            metadata,
            audioSource,
          };
        }
      }
      throw new Error('TikWM não retornou vídeo');
    },

    // API 2: TikTokDownloader API alternativa
    async () => {
      console.log('[BelchiorReceitas] Tentando TikTokDownloader API...');
      const response = await fetch(`https://api16-normal-useast5.us.tiktokv.com/aweme/v1/feed/?aweme_id=${url.match(/video\/(\d+)/)?.[1] || ''}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (!response.ok) throw new Error('API alternativa falhou');
      const data = await response.json();

      // Tentar extrair URL do vídeo da resposta
      const aweme = data?.aweme_list?.[0];
      const videoData = aweme?.video;
      const videoUrl = videoData?.play_addr?.url_list?.[0];
      const audioUrl = aweme?.music?.play_url?.url_list?.[0];
      const preferMusic = process.env.TIKTOK_PREFER_MUSIC_AUDIO === '1';
      const cover = videoData?.cover?.url_list?.[0] || videoData?.origin_cover?.url_list?.[0];
      const description = aweme?.desc;
      const durationRaw = aweme?.duration;
      const duration = typeof durationRaw === 'number'
        ? (durationRaw > 1000 ? Math.round(durationRaw / 1000) : durationRaw)
        : undefined;
      const metadata: VideoMetadata | undefined = aweme
        ? {
            platform: 'tiktok',
            ...(description ? { title: description, description } : {}),
            ...(typeof duration === 'number' ? { duration } : {}),
            ...(cover ? { thumbnailUrl: cover } : {}),
          }
        : undefined;
      const mediaUrl = preferMusic ? (audioUrl || videoUrl) : (videoUrl || audioUrl);
      const audioSource: 'tiktok-video' | 'tiktok-music' | undefined = mediaUrl
        ? (mediaUrl === videoUrl ? 'tiktok-video' : 'tiktok-music')
        : undefined;
      if (mediaUrl) {
        console.log(
          `[BelchiorReceitas] ✅ TikTokDownloader: URL de ${audioSource === 'tiktok-video' ? 'vídeo' : 'áudio'} obtida`
        );
        return { videoUrl: mediaUrl, thumbnailUrl: cover, metadata, audioSource };
      }
      throw new Error('URL não encontrada na resposta');
    }
  ];

  let videoUrl: string | null = null;
  let thumbnailUrl: string | undefined;
  for (const apiCall of apis) {
    try {
      const result = await apiCall();
      if (result) {
        videoUrl = typeof result === 'string' ? result : result.videoUrl;
        thumbnailUrl = typeof result === 'string' ? undefined : result.thumbnailUrl;
        break;
      }
    } catch (error: any) {
      console.warn('[BelchiorReceitas] API TikTok falhou:', error?.message?.substring(0, 100));
    }
  }

  if (!videoUrl) {
    throw new Error('Não foi possível obter URL do vídeo do TikTok. Tente um vídeo público.');
  }

  // Retornar URL do vídeo (Whisper consegue transcrever direto de URL)
  console.log('[BelchiorReceitas] ✅ URL do vídeo TikTok pronta para transcrição');
  return {
    audioUrl: videoUrl,
    thumbnailUrl,
    thumbnailSource: thumbnailUrl ? 'tiktok-cover' : undefined,
    cleanup: async () => {
      // Sem arquivo local, nada para limpar
      console.log('[BelchiorReceitas] Cleanup: nenhum arquivo para remover');
    }
  };
}

// Download Instagram via API - Retorna URL do vídeo (sem arquivo local)
async function downloadInstagramViaAPI(url: string): Promise<DownloadResult> {
  console.log('[BelchiorReceitas] Obtendo URL do vídeo Instagram via API...');

  // Tentar múltiplas APIs para Instagram
  const apis = [
    // API 1: DDInstagram API
    async () => {
      console.log('[BelchiorReceitas] Tentando DDInstagram API...');
      const response = await fetch('https://ddinstagram.com/api/instagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error('DDInstagram falhou');

      const data = await response.json();
      if (data && data.success && data.download_url) {
        console.log('[BelchiorReceitas] ✅ DDInstagram: URL obtida');
        return {
          videoUrl: data.download_url,
          thumbnailUrl: data.preview || data.thumbnail || data.thumbnail_url,
        };
      }
      throw new Error('DDInstagram não retornou URL válida');
    },

    // API 2: Insta.save API (alternativa)
    async () => {
      console.log('[BelchiorReceitas] Tentando Insta.save API...');
      const encodedUrl = encodeURIComponent(url);
      const response = await fetch(`https://api.insta.save/v1/media?url=${encodedUrl}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (!response.ok) throw new Error('Insta.save falhou');

      const data = await response.json();
      if (data && data.video_url) {
        console.log('[BelchiorReceitas] ✅ Insta.save: URL obtida');
        return {
          videoUrl: data.video_url,
          thumbnailUrl: data.thumbnail || data.thumb || data.preview || data.thumbnail_url,
        };
      }
      throw new Error('Insta.save não retornou URL válida');
    }
  ];

  let videoUrl: string | null = null;
  let thumbnailUrl: string | undefined;

  for (const apiCall of apis) {
    try {
      const result = await apiCall();
      if (result) {
        videoUrl = typeof result === 'string' ? result : result.videoUrl;
        thumbnailUrl = typeof result === 'string' ? undefined : result.thumbnailUrl;
        break;
      }
    } catch (error: any) {
      console.warn('[BelchiorReceitas] Método Instagram falhou:', error?.message?.substring(0, 100));
    }
  }

  if (!videoUrl) {
    throw new Error('Instagram: Não foi possível obter URL. Instagram requer vídeos públicos. Use YouTube ou TikTok para melhores resultados.');
  }

  // Retornar URL do vídeo (Whisper consegue transcrever direto de URL)
  console.log('[BelchiorReceitas] ✅ URL do vídeo Instagram pronta para transcrição');
  return {
    audioUrl: videoUrl,
    thumbnailUrl,
    thumbnailSource: thumbnailUrl ? 'ig-thumb' : undefined,
    cleanup: async () => {
      // Sem arquivo local, nada para limpar
      console.log('[BelchiorReceitas] Cleanup: nenhum arquivo para remover');
    }
  };
}
