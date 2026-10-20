/**
 * Resolves media stream and download URLs against the active API backend,
 * fixing legacy or seeded localhost URLs dynamically across development and production.
 */

const getApiBase = (): string => {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) {
    return typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5000/api'
      : 'https://moviebuzz-server.onrender.com/api';
  }
  let clean = raw.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api')) {
    clean += '/api';
  }
  return clean;
};

export const resolveMediaUrl = (rawUrl?: string): string => {
  if (!rawUrl) return '';
  const apiBase = getApiBase();
  const backendOrigin = apiBase.replace(/\/api\/?$/, '');

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
 * - Telegram media → MTProto download endpoint
 * - HLS/DASH/proxy streams → FFmpeg remux-to-MP4 endpoint
 * - Direct files → pass-through with Content-Disposition
 * The resulting URL always produces a playable .mp4 file.
 */
export const getDownloadUrl = (
  media: { provider?: string; providerMediaId?: string; streamUrl?: string; downloadUrl?: string; quality?: string } | null | undefined,
  title?: string,
): string => {
  if (!media) return '';
  const apiBase = getApiBase();

  // Telegram media: dedicated MTProto chunk download
  if (media.provider === 'telegram' && media.providerMediaId) {
    return `${apiBase}/media/download-file/${encodeURIComponent(media.providerMediaId)}`;
  }

  // HLS, DASH, proxy-file, or direct MP4 stream: use the download-stream remux endpoint
  const resolvedStream = resolveMediaUrl(media.streamUrl);
  if (
    resolvedStream &&
    (resolvedStream.includes('.m3u8') ||
      resolvedStream.includes('.mpd') ||
      resolvedStream.includes('/streaming/') ||
      resolvedStream.includes('/proxy-file/') ||
      resolvedStream.includes('.mp4'))
  ) {
    const params = new URLSearchParams({
      url: resolvedStream,
      title: title || 'CineStream',
      quality: media.quality || '1080p',
    });
    return `${apiBase}/media/download-stream?${params.toString()}`;
  }

  // Fallback: use stored downloadUrl or resolved stream URL directly
  return resolveMediaUrl(media.downloadUrl) || resolvedStream || '';
};
