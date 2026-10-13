// --- CineStream PWA App Shell + API Cache ---
const CACHE_NAME = 'cinestream-pwa-v4';
const API_CACHE_NAME = 'cinestream-api-v4';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

// API routes we proactively cache for instant mobile loads (stale-while-revalidate)
// Streaming segments (.mpd, .m4s, .mp4 proxies) are intentionally NOT cached here
// to avoid exhausting device storage.
const CACHEABLE_API_PATTERNS = [
  /\/api\/content\/?(\?|$)/,         // content list
  /\/api\/content\/[^/]+$/,           // single content detail
  /\/api\/series\/[^/]+$/,            // series detail
  /\/api\/content\/list/,
  /\/api\/search/,
];

// Streaming proxies should never be cached in SW (they're byte-range streams)
const STREAMING_PATTERNS = [
  /\/api\/streaming\/dash\//,
  /\/api\/streaming\/proxy/,
  /\/api\/streaming\/proxy-file\//,
  /\/api\/streaming\/transcode-stream\//,
  /\.m4s$/,
  /\.mpd$/,
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== API_CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Intercept
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Never intercept streaming byte-range proxies — let them go direct
  const isStreamingRequest = STREAMING_PATTERNS.some((p) => p.test(url.pathname));
  if (isStreamingRequest) return;

  // API Requests: cacheable catalogue endpoints get stale-while-revalidate
  if (url.pathname.startsWith('/api')) {
    const isCacheable = CACHEABLE_API_PATTERNS.some((p) => p.test(url.pathname + url.search));

    if (isCacheable) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(API_CACHE_NAME);
          const cached = await cache.match(event.request);

          // Fire network request in background regardless
          const fetchPromise = fetch(event.request).then(async (networkRes) => {
            if (networkRes && networkRes.status === 200) {
              cache.put(event.request, networkRes.clone());
            }
            return networkRes;
          }).catch(() => null);

          // If we have a cached response, return it immediately (stale-while-revalidate)
          if (cached) return cached;

          // Otherwise wait for network
          const networkRes = await fetchPromise;
          return networkRes || new Response(
            JSON.stringify({ error: 'Offline mode active. Reconnect to browse content.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })()
      );
      return;
    }

    // Non-cacheable API (auth, progress, etc.): network-only
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline mode active. Reconnect to stream videos.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // HTML / App shell navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = (await caches.match('/index.html')) || (await caches.match('/'));
        if (cached) return cached;
        return new Response(
          '<!DOCTYPE html><html><body><h1>Offline</h1><p>Please check your internet connection.</p></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  // Static Assets: Cache First / Stale-While-Revalidate with fallback Response
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        fetch(event.request).then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse);
          }
        }).catch(() => {});
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        return new Response('Asset unavailable offline', { status: 404 });
      }
    })()
  );
});
