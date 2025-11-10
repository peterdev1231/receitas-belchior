// Biblioteca para baixar vídeos de diferentes plataformas
import { VideoMetadata } from '@/types/recipe';

// Extrair metadados do vídeo (descrição, título, etc)
async function extractVideoMetadata(url: string): Promise<VideoMetadata | null> {
  try {
    console.log('[BelchiorReceitas] Extraindo metadados do vídeo...');
    const { default: YTDlpWrap } = await import('yt-dlp-wrap');
    const ytDlpWrap = new YTDlpWrap();
    
    const metadataJson = await ytDlpWrap.execPromise([
      url,
      '--dump-json',
      '--no-warnings',
      '--skip-download',
      '--socket-timeout', '30',
    ]);
    
    const metadata = JSON.parse(metadataJson);
    
    const result = {
      title: metadata.title || metadata.fulltitle || '',
      description: metadata.description || '',
      hashtags: metadata.tags || [],
      duration: metadata.duration || 0,
      platform: url.includes('youtube') || url.includes('youtu.be') ? 'youtube' as const :
                url.includes('tiktok') ? 'tiktok' as const :
                url.includes('instagram') ? 'instagram' as const : undefined,
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

export async function downloadVideoViaAPI(url: string): Promise<{
  audioUrl?: string;
  audioPath?: string;
  metadata: VideoMetadata | null;
  cleanup: () => Promise<void>
}> {
  const { join } = await import('path');
  const { tmpdir } = await import('os');

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const audioPath = join(tmpdir(), `belchior-${generateId()}.mp3`);

  console.log('[BelchiorReceitas] Detectando plataforma...');

  // PASSO 1: Extrair metadados (descrição, título)
  const metadata = await extractVideoMetadata(url);

  // Detectar plataforma
  const isTikTok = url.includes('tiktok.com') || url.includes('vm.tiktok') || url.includes('vt.tiktok');
  const isInstagram = url.includes('instagram.com');
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

  // PASSO 2: Baixar áudio
  let result;
  if (isYouTube) {
    // YouTube usa yt-dlp (com arquivo local)
    result = await downloadWithYtDlp(url, audioPath);
  } else if (isTikTok) {
    // TikTok usa API - retorna URL direto (sem arquivo local)
    result = await downloadTikTokViaAPI(url);
  } else if (isInstagram) {
    // Instagram usa API - retorna URL direto (sem arquivo local)
    result = await downloadInstagramViaAPI(url);
  } else {
    // Fallback: tentar com yt-dlp
    result = await downloadWithYtDlp(url, audioPath);
  }

  // Retornar áudio + metadados
  return {
    ...result,
    metadata,
  };
}

// Download com yt-dlp (YouTube)
async function downloadWithYtDlp(url: string, audioPath: string): Promise<{ audioPath: string; cleanup: () => Promise<void> }> {
  const { default: YTDlpWrap } = await import('yt-dlp-wrap');
  
  console.log('[BelchiorReceitas] Usando yt-dlp para YouTube...');
  
  const ytDlpWrap = new YTDlpWrap();
  
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
async function downloadTikTokViaAPI(url: string): Promise<{ audioUrl: string; cleanup: () => Promise<void> }> {
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
        const videoUrl = data.data.play || data.data.wmplay || data.data.hdplay;
        if (videoUrl) {
          console.log('[BelchiorReceitas] ✅ TikWM: URL do vídeo obtida');
          return videoUrl;
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
      const videoUrl = data?.aweme_list?.[0]?.video?.play_addr?.url_list?.[0];
      if (videoUrl) {
        console.log('[BelchiorReceitas] ✅ TikTokDownloader: URL obtida');
        return videoUrl;
      }
      throw new Error('URL não encontrada na resposta');
    }
  ];

  let videoUrl: string | null = null;
  for (const apiCall of apis) {
    try {
      const result = await apiCall();
      if (result) {
        videoUrl = result;
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
    cleanup: async () => {
      // Sem arquivo local, nada para limpar
      console.log('[BelchiorReceitas] Cleanup: nenhum arquivo para remover');
    }
  };
}

// Download Instagram via API - Retorna URL do vídeo (sem arquivo local)
async function downloadInstagramViaAPI(url: string): Promise<{ audioUrl: string; cleanup: () => Promise<void> }> {
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
        return data.download_url;
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
        return data.video_url;
      }
      throw new Error('Insta.save não retornou URL válida');
    }
  ];

  let videoUrl: string | null = null;

  for (const apiCall of apis) {
    try {
      const result = await apiCall();
      if (result) {
        videoUrl = result;
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
    cleanup: async () => {
      // Sem arquivo local, nada para limpar
      console.log('[BelchiorReceitas] Cleanup: nenhum arquivo para remover');
    }
  };
}

