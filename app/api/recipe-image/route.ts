import { NextRequest, NextResponse } from 'next/server';
import { extractVideoMetadata } from '@/lib/videoDownloader';

export const dynamic = 'force-dynamic';

const detectPlatform = (url: string) => {
  if (/tiktok\.com|vm\.tiktok|vt\.tiktok/.test(url)) return 'tiktok';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  return undefined;
};

const parseYouTubeId = (url: string): string | null => {
  const regex = /(?:youtu\.be\/|v=|shorts\/)([\w-]{6,})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const shouldUseYtDlpMetadata = (platform?: string) => {
  return platform === 'youtube' || !platform || process.env.ENABLE_YTDLP_METADATA === '1';
};

async function fetchTikTokCover(url: string): Promise<string | undefined> {
  const apis = [
    async () => {
      const response = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ url, hd: 1 }),
      });
      const data = await response.json();
      if (data.code === 0 && data.data) {
        return data.data.cover || data.data.origin_cover;
      }
      throw new Error('TikWM não retornou capa');
    },
    async () => {
      const response = await fetch(
        `https://api16-normal-useast5.us.tiktokv.com/aweme/v1/feed/?aweme_id=${url.match(/video\/(\d+)/)?.[1] || ''}`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }
      );
      if (!response.ok) throw new Error('TikTok alt falhou');
      const data = await response.json();
      const videoData = data?.aweme_list?.[0]?.video;
      return (
        videoData?.cover?.url_list?.[0] ||
        videoData?.origin_cover?.url_list?.[0] ||
        undefined
      );
    },
  ];

  for (const api of apis) {
    try {
      const cover = await api();
      if (cover) return cover;
    } catch (error) {
      console.warn('[BelchiorReceitas] Falha ao buscar capa TikTok:', (error as any)?.message);
    }
  }
  return undefined;
}

async function fetchInstagramThumb(url: string): Promise<string | undefined> {
  const apis = [
    async () => {
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
      if (data && data.success) {
        return data.preview || data.thumbnail || data.thumbnail_url;
      }
      throw new Error('DDInstagram sem capa');
    },
    async () => {
      const encodedUrl = encodeURIComponent(url);
      const response = await fetch(`https://api.insta.save/v1/media?url=${encodedUrl}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!response.ok) throw new Error('Insta.save falhou');
      const data = await response.json();
      return data?.thumbnail || data?.thumb || data?.preview || data?.thumbnail_url;
    },
  ];

  for (const api of apis) {
    try {
      const thumb = await api();
      if (thumb) return thumb;
    } catch (error) {
      console.warn('[BelchiorReceitas] Falha ao buscar capa Instagram:', (error as any)?.message);
    }
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json();

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'videoUrl é obrigatório' },
        { status: 400 }
      );
    }

    const platform = detectPlatform(videoUrl);
    let imageUrl: string | undefined;
    let imageSource: 'tiktok-cover' | 'yt-thumb' | 'ig-thumb' | 'fallback' | undefined;

    // 1) Tenta via metadados (yt-dlp --dump-json)
    try {
      if (shouldUseYtDlpMetadata(platform)) {
        const metadata = await extractVideoMetadata(videoUrl);
        if (metadata?.thumbnailUrl) {
          imageUrl = metadata.thumbnailUrl;
          imageSource =
            platform === 'tiktok'
              ? 'tiktok-cover'
              : platform === 'instagram'
                ? 'ig-thumb'
                : 'yt-thumb';
        } else if (metadata?.thumbnails && metadata.thumbnails.length > 0) {
          imageUrl = metadata.thumbnails[metadata.thumbnails.length - 1];
          imageSource = platform === 'instagram' ? 'ig-thumb' : 'yt-thumb';
        }
      }
    } catch (error) {
      console.warn('[BelchiorReceitas] Falha ao obter metadados na rota recipe-image:', (error as any)?.message);
    }

    // 2) Fallbacks por plataforma
    if (!imageUrl && platform === 'tiktok') {
      imageUrl = await fetchTikTokCover(videoUrl);
      if (imageUrl) imageSource = 'tiktok-cover';
    }

    if (!imageUrl && platform === 'instagram') {
      imageUrl = await fetchInstagramThumb(videoUrl);
      if (imageUrl) imageSource = 'ig-thumb';
    }

    if (!imageUrl && platform === 'youtube') {
      const id = parseYouTubeId(videoUrl);
      if (id) {
        imageUrl = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
        imageSource = 'yt-thumb';
      }
    }

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível obter uma capa para este vídeo' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      imageSource: imageSource || 'fallback',
      imageFetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[BelchiorReceitas] Erro na rota recipe-image:', error?.message || error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar capa' },
      { status: 500 }
    );
  }
}
