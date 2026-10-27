/**
 * Resolves media stream and download URLs against the active API backend,
 * fixing legacy or seeded localhost URLs dynamically across development and production.
 */

const getApiBase = (): string => {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) {
    return typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5000/api'
      : 'https://moviebuzz-4slf.onrender.com/api';
  }
  let clean = raw.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api')) {
    clean += '/api';
  }
  return clean;
};

export const getCloudflareProxyUrl = (): string =>
  import.meta.env.VITE_CLOUDFLARE_STREAM_PROXY_URL ||
  import.meta.env.VITE_CLOUDFLARE_PROXY_URL ||
  'https://cinestream-stream-proxy.dev-patel-codinggita.workers.dev';

export const wrapStreamWithCloudflare = (rawUrl?: string): string => {
  if (!rawUrl) return '';
  const resolved = resolveMediaUrl(rawUrl);
  // Never route local development servers through external Cloudflare worker (worker cannot reach localhost)
  if (resolved.includes('localhost') || resolved.includes('127.0.0.1')) {
    return resolved;
  }
  const cfProxy = getCloudflareProxyUrl()?.trim().replace(/\/+$/, '');
  if (!cfProxy) return resolved;

  // If already routing through Cloudflare, don't double wrap
  if (resolved.includes('workers.dev') || resolved.includes('cloudflare')) {
    return resolved;
  }

  // Route Telegram proxy-file streams through Cloudflare /tg/ edge cache for fastest chunk loading & 0 server bandwidth
  if (resolved.includes('/proxy-file/')) {
    const fileId = resolved.substring(resolved.indexOf('/proxy-file/') + '/proxy-file/'.length).split('?')[0];
    return `${cfProxy}/tg/${fileId}`;
  }

  // If it's a backend /streaming/proxy?url=..., extract raw upstream CDN target and route directly through CF /proxy
  if (resolved.includes('/api/streaming/proxy')) {
    try {
      const u = new URL(resolved);
      const upstream = u.searchParams.get('url');
      if (upstream) {
        return `${cfProxy}/proxy?url=${encodeURIComponent(upstream)}`;
      }
    } catch {}
  }

  // If it's an external embed or CDN stream, route through Cloudflare /embed
  const marker = resolved.includes('.m3u8') ? '.m3u8' : resolved.includes('.mpd') ? '.mpd' : '.mp4';
  return `${cfProxy}/embed?url=${encodeURIComponent(resolved)}&ext=${marker}`;
};

export const resolveMediaUrl = (rawUrl?: string): string => {
  if (!rawUrl) return '';
  const cfProxy = getCloudflareProxyUrl()?.trim().replace(/\/+$/, '');
  const apiBase = getApiBase();
  const backendOrigin = apiBase.replace(/\/api\/?$/, '');

  // 1. If already a Cloudflare Worker URL, return as is
  if (rawUrl.includes('workers.dev') || rawUrl.includes('cloudflare')) {
    return rawUrl;
  }

  // 2. Telegram stream proxy: route to Cloudflare /tg/ edge cache
  if (rawUrl.includes('/proxy-file/')) {
    const fileId = rawUrl.substring(rawUrl.indexOf('/proxy-file/') + '/proxy-file/'.length).split('?')[0];
    if (cfProxy && !rawUrl.includes('localhost') && !rawUrl.includes('127.0.0.1')) {
      return `${cfProxy}/tg/${fileId}`;
    }
  }

  // 3. Streaming proxy: route to Cloudflare /proxy
  if (rawUrl.includes('/api/streaming/proxy')) {
    try {
      const u = new URL(rawUrl.startsWith('http') ? rawUrl : `${backendOrigin}${rawUrl}`);
      const upstream = u.searchParams.get('url');
      if (upstream && cfProxy) {
        return `${cfProxy}/proxy?url=${encodeURIComponent(upstream)}`;
      }
    } catch {}
  }

  // 4. External HLS, DASH, or CDN streams: route to Cloudflare /embed
  if (
    cfProxy &&
    !rawUrl.includes('localhost') &&
    !rawUrl.includes('127.0.0.1') &&
    (rawUrl.includes('.m3u8') || rawUrl.includes('.mpd') || rawUrl.includes('sportslive') || rawUrl.includes('aoneroom') || rawUrl.includes('fmovies'))
  ) {
    const marker = rawUrl.includes('.m3u8') ? '.m3u8' : rawUrl.includes('.mpd') ? '.mpd' : '.mp4';
    return `${cfProxy}/embed?url=${encodeURIComponent(rawUrl)}&ext=${marker}`;
  }

  // Standard API base resolution
  if (rawUrl.includes('/api/media/')) {
    const mediaPath = rawUrl.substring(rawUrl.indexOf('/api/media/'));
    return `${backendOrigin}${mediaPath}`;
  }
  if (rawUrl.includes('/api/streaming/')) {
    const streamPath = rawUrl.substring(rawUrl.indexOf('/api/streaming/'));
    return `${backendOrigin}${streamPath}`;
  }
  if (rawUrl.startsWith('http://localhost:5000')) {
    return rawUrl.replace('http://localhost:5000', backendOrigin);
  }
  if (rawUrl.startsWith('/api/')) {
    return `${backendOrigin}${rawUrl}`;
  }
  return rawUrl;
};

/**
 * Computes a proper MP4 download URL for any media item regardless of provider.
 * Routes 100% of video download bytes through Cloudflare Workers with Content-Disposition attachment.
 * Uses 0 backend/server bandwidth!
 */
export const getDownloadUrl = (
  media: { provider?: string; providerMediaId?: string; streamUrl?: string; downloadUrl?: string; quality?: string } | null | undefined,
  title?: string,
): string => {
  if (!media) return '';
  const cfProxy = getCloudflareProxyUrl()?.trim().replace(/\/+$/, '');
  const safeTitle = (title || 'CineStream').trim();
  const quality = media.quality || '1080p';
  const fullTitle = `${safeTitle}_${quality}`;

  // 1. Telegram media: route through Cloudflare Worker's /download with /tg/ file URL
  if (media.provider === 'telegram' && media.providerMediaId) {
    if (cfProxy) {
      const tgFileUrl = `${cfProxy}/tg/${encodeURIComponent(media.providerMediaId)}`;
      return `${cfProxy}/download?url=${encodeURIComponent(tgFileUrl)}&title=${encodeURIComponent(fullTitle)}`;
    }
  }

  // 2. Direct MP4 or external stream: route through Cloudflare /download
  const stream = media.streamUrl || media.downloadUrl || '';
  if (stream) {
    const wrapped = wrapStreamWithCloudflare(stream);
    if (cfProxy && !wrapped.includes('localhost') && !wrapped.includes('127.0.0.1')) {
      return `${cfProxy}/download?url=${encodeURIComponent(wrapped)}&title=${encodeURIComponent(fullTitle)}`;
    }
    return wrapped;
  }

  return '';
};
