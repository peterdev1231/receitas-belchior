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
  audioPath: string; 
  metadata: VideoMetadata | null;
  cleanup: () => Promise<void> 
}> {
  const { join } = await import('path');
  const { tmpdir } = await import('os');
  const { writeFile, unlink } = await import('fs/promises');
  
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const audioPath = join(tmpdir(), `belchior-${generateId()}.mp3`);
  
  console.log('[BelchiorReceitas] Detectando plataforma...');
  
  // PASSO 1: Extrair metadados (descrição, título)
  const metadata = await extractVideoMetadata(url);
  
  // Detectar plataforma
  const isTikTok = url.includes('tiktok.com') || url.includes('vm.tiktok');
  const isInstagram = url.includes('instagram.com');
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  
  // PASSO 2: Baixar áudio
  let result;
  if (isYouTube) {
    // YouTube usa yt-dlp
    result = await downloadWithYtDlp(url, audioPath);
  } else if (isTikTok) {
    // TikTok usa API de terceiros
    result = await downloadTikTokViaAPI(url, audioPath);
  } else if (isInstagram) {
    // Instagram usa API de terceiros
    result = await downloadInstagramViaAPI(url, audioPath);
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

// Download TikTok via API
async function downloadTikTokViaAPI(url: string, audioPath: string): Promise<{ audioPath: string; cleanup: () => Promise<void> }> {
  console.log('[BelchiorReceitas] Baixando TikTok via API...');
  
  // Tentar múltiplas APIs
  const apis = [
    // API 1: TikWM com vídeo completo
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
        // Pegar URL do vídeo (não música) para extrair áudio depois
        const videoUrl = data.data.play || data.data.wmplay || data.data.hdplay;
        if (videoUrl) {
          console.log('[BelchiorReceitas] TikWM: URL do vídeo obtida');
          return { type: 'video', url: videoUrl };
        }
      }
      throw new Error('TikWM não retornou vídeo');
    },
    
    // API 2: yt-dlp como fallback robusto
    async () => {
      console.log('[BelchiorReceitas] Tentando yt-dlp para TikTok...');
      const { default: YTDlpWrap } = await import('yt-dlp-wrap');
      const ytDlpWrap = new YTDlpWrap();
      
      await ytDlpWrap.execPromise([
        url,
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '5',
        '-o', audioPath,
        '--no-playlist',
        '--no-warnings',
        '--extractor-retries', '5',
        '--socket-timeout', '30',
      ]);
      
      return { type: 'saved', url: null };
    }
  ];
  
  let result = null;
  for (const apiCall of apis) {
    try {
      result = await apiCall();
      if (result) break;
    } catch (error: any) {
      console.warn('[BelchiorReceitas] API TikTok falhou:', error?.message?.substring(0, 100));
    }
  }
  
  if (!result) {
    throw new Error('Não foi possível baixar do TikTok. Tente um vídeo público do YouTube.');
  }
  
  // Se yt-dlp já salvou
  if (result.type === 'saved') {
    const { unlink } = await import('fs/promises');
    return {
      audioPath,
      cleanup: async () => {
        await unlink(audioPath).catch(() => {});
      }
    };
  }
  
  // Baixar o vídeo e extrair áudio com ffmpeg (se disponível) ou salvar como está
  console.log('[BelchiorReceitas] Baixando vídeo do TikTok...');
  const videoResponse = await fetch(result.url);
  if (!videoResponse.ok) {
    throw new Error('Falha ao baixar vídeo do TikTok');
  }
  
  const videoBuffer = await videoResponse.arrayBuffer();
  
  // Salvar como MP4 primeiro, depois tentar converter
  const { writeFile, unlink } = await import('fs/promises');
  const { join } = await import('path');
  const { tmpdir } = await import('os');
  
  const videoPath = audioPath.replace('.mp3', '.mp4');
  await writeFile(videoPath, Buffer.from(videoBuffer));
  
  // Tentar converter com yt-dlp (que usa ffmpeg internamente)
  try {
    const { default: YTDlpWrap } = await import('yt-dlp-wrap');
    const ytDlpWrap = new YTDlpWrap();
    
    await ytDlpWrap.execPromise([
      videoPath,
      '-x',
      '--audio-format', 'mp3',
      '-o', audioPath,
    ]);
    
    await unlink(videoPath).catch(() => {});
    console.log('[BelchiorReceitas] ✅ TikTok convertido para áudio');
  } catch (conversionError) {
    // Se não conseguir converter, usar o vídeo mesmo
    console.warn('[BelchiorReceitas] Usando vídeo sem conversão');
    await unlink(videoPath).catch(() => {});
    
    // Salvar o vídeo como "áudio" mesmo
    await writeFile(audioPath, Buffer.from(videoBuffer));
  }
  
  return {
    audioPath,
    cleanup: async () => {
      await unlink(audioPath).catch(() => {});
    }
  };
}

// Download Instagram via API
async function downloadInstagramViaAPI(url: string, audioPath: string): Promise<{ audioPath: string; cleanup: () => Promise<void> }> {
  console.log('[BelchiorReceitas] Baixando Instagram via API...');
  
  // Tentar múltiplas APIs para Instagram
  const apis = [
    // API 1: SnapInsta API
    async () => {
      console.log('[BelchiorReceitas] Tentando SnapInsta API...');
      const response = await fetch('https://snapinsta.app/api/ajaxSearch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: `q=${encodeURIComponent(url)}&t=media&lang=en`,
      });
      
      if (!response.ok) throw new Error('SnapInsta falhou');
      
      const data = await response.json();
      if (data && data.data) {
        // Tentar extrair URL do vídeo
        const htmlData = data.data;
        const videoMatch = htmlData.match(/<a[^>]*href="([^"]+)"[^>]*>.*?Download/i);
        if (videoMatch && videoMatch[1]) {
          const videoUrl = videoMatch[1].replace(/&amp;/g, '&');
          console.log('[BelchiorReceitas] SnapInsta: URL obtida');
          return { type: 'video', url: videoUrl };
        }
      }
      throw new Error('SnapInsta não retornou URL válida');
    },
    
    // API 2: DDInstagram API
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
        console.log('[BelchiorReceitas] DDInstagram: URL obtida');
        return { type: 'video', url: data.download_url };
      }
      throw new Error('DDInstagram não retornou URL válida');
    },
    
    // API 3: Insta.save API (alternativa)
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
        console.log('[BelchiorReceitas] Insta.save: URL obtida');
        return { type: 'video', url: data.video_url };
      }
      throw new Error('Insta.save não retornou URL válida');
    },
    
    // API 4: yt-dlp como último fallback
    async () => {
      console.log('[BelchiorReceitas] Tentando yt-dlp para Instagram...');
      const { default: YTDlpWrap } = await import('yt-dlp-wrap');
      const ytDlpWrap = new YTDlpWrap();
      
      await ytDlpWrap.execPromise([
        url,
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '5',
        '-o', audioPath,
        '--no-playlist',
        '--no-warnings',
        '--extractor-retries', '5',
        '--socket-timeout', '30',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ]);
      
      console.log('[BelchiorReceitas] ✅ Instagram baixado com yt-dlp');
      return { type: 'saved', url: null };
    }
  ];
  
  let result = null;
  
  for (const apiCall of apis) {
    try {
      result = await apiCall();
      if (result) break;
    } catch (error: any) {
      console.warn('[BelchiorReceitas] Método Instagram falhou:', error?.message?.substring(0, 100));
    }
  }
  
  if (!result) {
    throw new Error('Instagram: Não foi possível baixar. Instagram requer vídeos públicos. Use YouTube ou TikTok para melhores resultados.');
  }
  
  // Se yt-dlp já salvou
  if (result.type === 'saved') {
    const { unlink } = await import('fs/promises');
    return {
      audioPath,
      cleanup: async () => {
        await unlink(audioPath).catch(() => {});
      }
    };
  }
  
  // Baixar o vídeo da API
  console.log('[BelchiorReceitas] Baixando vídeo do Instagram...');
  const videoResponse = await fetch(result.url);
  if (!videoResponse.ok) {
    throw new Error('Falha ao baixar vídeo do Instagram via API');
  }
  
  const videoBuffer = await videoResponse.arrayBuffer();
  
  // Salvar como MP4 e converter para MP3
  const { writeFile, unlink } = await import('fs/promises');
  const videoPath = audioPath.replace('.mp3', '.mp4');
  await writeFile(videoPath, Buffer.from(videoBuffer));
  
  // Tentar converter com yt-dlp
  try {
    const { default: YTDlpWrap } = await import('yt-dlp-wrap');
    const ytDlpWrap = new YTDlpWrap();
    
    await ytDlpWrap.execPromise([
      videoPath,
      '-x',
      '--audio-format', 'mp3',
      '-o', audioPath,
    ]);
    
    await unlink(videoPath).catch(() => {});
    console.log('[BelchiorReceitas] ✅ Instagram convertido para áudio');
  } catch (conversionError) {
    // Fallback: salvar vídeo como "áudio"
    console.warn('[BelchiorReceitas] Conversão falhou, usando arquivo direto');
    await unlink(videoPath).catch(() => {});
    await writeFile(audioPath, Buffer.from(videoBuffer));
  }
  
  return {
    audioPath,
    cleanup: async () => {
      await unlink(audioPath).catch(() => {});
    }
  };
}

