/**
 * Resolves media stream and download URLs against the active API backend,
 * fixing legacy or seeded localhost URLs dynamically across development and production.
 */
export const resolveMediaUrl = (rawUrl?: string): string => {
  if (!rawUrl) return '';
  const apiBase =
    import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5000/api'
      : 'https://moviebuzz-99fb.onrender.com/api');
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
