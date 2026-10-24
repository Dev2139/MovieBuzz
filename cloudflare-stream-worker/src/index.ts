/**
 * CineStream Cloudflare Stream Proxy Worker
 * 
 * Provides 100% FREE, UNLIMITED bandwidth video streaming directly from upstream CDNs.
 * - Injects anti-hotlinking headers (Referer, Edge-Cache-Cookie)
 * - Caches MPEG-DASH segments (.m4s) on Cloudflare's global edge network for instant loading
 * - Bypasses CORS restrictions
 * - Uses 0 server bandwidth
 */

const ALLOWED_STREAM_DOMAINS = [
  'aoneroom.com',
  'hakunaymatata.com',
  'vegamovies.pet',
  'vegamovies',
  'inmoviebox.com',
  'fmoviesunblocked.net',
  'sportslive.wine',
];

const DOWNLOAD_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
  Referer: 'https://sportslive.wine',
  Origin: 'https://h5.aoneroom.com',
};

function isAllowedUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return ALLOWED_STREAM_DOMAINS.some((domain) => parsed.hostname.endsWith(domain));
  } catch {
    return false;
  }
}

function corsHeaders(): Headers {
  const h = new Headers();
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  h.set('Access-Control-Allow-Headers', '*');
  h.set('Access-Control-Max-Age', '86400');
  return h;
}

// ---------------------------------------------------------------------------
// Generic embed relay (arbitrary CDN host + per-source Referer)
// ---------------------------------------------------------------------------

// SSRF guard: only public http(s) hosts, never loopback/private/link-local.
function isSafeExternalUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname;
    if (!host) return false;
    if (host === 'localhost' || /\.(local|internal|localdomain)$/.test(host)) return false;
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const a = parseInt(ipv4[1], 10);
      const b = parseInt(ipv4[2], 10);
      if (a === 0 || a === 10 || a === 127) return false;
      if (a === 169 && b === 254) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 100 && b >= 64 && b <= 127) return false;
    }
    if (host === '::1' || host.startsWith('fe80') || host.startsWith('fd') || host.startsWith('fc')) return false;
    return true;
  } catch {
    return false;
  }
}

function looksLikeM3u8(u: string): boolean {
  return /\.m3u8(\?|$)/i.test(u);
}

function looksLikeMpd(u: string): boolean {
  return /\.mpd(\?|$)/i.test(u);
}

// ---------------------------------------------------------------------------
// DASH relay (/es/<token>/<upstream-host>/<upstream-path>?<orig-query>)
// SegmentTemplate values keep their literal $RepresentationID$ / $Number%05d$
// tokens so dash.js still substitutes them; everything before the tokens is
// rewritten to route through this worker with the hotlink headers injected.
// ---------------------------------------------------------------------------

interface DashTokenPayload {
  r?: string; // referer to inject
}

function encodeDashToken(payload: DashTokenPayload): string {
  const b64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return b64;
}

function decodeDashToken(token: string): DashTokenPayload | null {
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

const SEGMENT_EXT_RE = /\.(m4s|mp4|ts|webm|aac|m4v|mka)(\?|$)/i;

// Build the /es proxy path for one upstream URL, preserving the raw (XML-
// escaped) query text exactly as it appeared in the manifest.
function esProxyPath(absUrl: string, token: string): string | null {
  try {
    // Split off the query before parsing: it may contain XML entities (&amp;)
    // that are not valid URL characters but must survive verbatim.
    const qIdx = absUrl.indexOf('?');
    const pathPart = qIdx === -1 ? absUrl : absUrl.slice(0, qIdx);
    const rawQuery = qIdx === -1 ? '' : absUrl.slice(qIdx); // includes '?'
    let hostPath = pathPart;
    if (/^https?:\/\//i.test(hostPath)) {
      const u = new URL(hostPath);
      hostPath = `${u.host}${u.pathname}`;
    } else if (hostPath.startsWith('/')) {
      hostPath = hostPath.slice(1);
    } else {
      const u = new URL(hostPath, 'https://placeholder.invalid/');
      hostPath = `${u.host}${u.pathname}`;
    }
    return `/es/${token}/${hostPath}${rawQuery}`;
  } catch {
    return null;
  }
}

// Rewrite an MPEG-DASH manifest: every SegmentTemplate / SegmentBase /
// SegmentURL / BaseURL reference is routed back through /es/<token>/.
function rewriteDashManifest(
  text: string,
  manifestUrl: string,
  referer: string,
  token: string
): string {
  const resolveAbs = (u: string): string => {
    try {
      if (/^https?:\/\//i.test(u)) return u;
      return new URL(u, manifestUrl).toString();
    } catch {
      return u;
    }
  };

  // 1. <BaseURL> elements (templates resolve against them if present).
  let out = text.replace(/<BaseURL>([^<]+)<\/BaseURL>/g, (m, raw) => {
    const abs = resolveAbs(raw.trim());
    const p = esProxyPath(abs, token);
    return p ? `<BaseURL>${new URL(manifestUrl).protocol}//${new URL(manifestUrl).host}${p}</BaseURL>` : m;
  });

  // 2. Quoted template attributes: initialization=, media=, index=, sourceURL=.
  out = out.replace(/\b(initialization|media|index|sourceURL)="([^"]+)"/g, (m, attr, val) => {
    if (!SEGMENT_EXT_RE.test(val)) return m; // not a media reference
    const p = esProxyPath(resolveAbs(val), token);
    return p ? `${attr}="${p}"` : m;
  });

  return out;
}

// Rewrite an HLS playlist so every child URI (segments, variant playlists,
// EXT-X-KEY / EXT-X-MAP URIs) resolves back through this /embed endpoint.
function rewriteHlsManifest(text: string, manifestUrl: string, referer: string, proxyBase: string): string {
  const resolveAbs = (u: string): string => new URL(u, manifestUrl).toString();
  const wrap = (abs: string, isManifest: boolean): string => {
    const p = new URLSearchParams({ url: abs });
    if (referer) p.set('r', referer);
    if (isManifest) p.set('ext', '.m3u8');
    return `${proxyBase}?${p.toString()}`;
  };
  const lines = text.split(/\r?\n/);
  const out = lines.map((line) => {
    const t = line.trim();
    if (t === '') return line;
    if (t.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_m, uri) => {
        try {
          return `URI="${wrap(resolveAbs(uri), looksLikeM3u8(uri))}"`;
        } catch {
          return _m;
        }
      });
    }
    try {
      const abs = resolveAbs(t);
      return wrap(abs, looksLikeM3u8(abs));
    } catch {
      return line;
    }
  });
  return out.join('\n');
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // 2. Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'CineStream Cloudflare Edge Stream Worker',
          bandwidth: 'unlimited-free',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 3. DASH Segment Proxy: /dash/:token/*
    if (url.pathname.startsWith('/dash/')) {
      const parts = url.pathname.slice('/dash/'.length).split('/');
      const token = parts[0];
      const subpath = parts.slice(1).join('/');

      if (!token || !subpath) {
        return new Response('Missing token or subpath', { status: 400 });
      }

      let payload: { b: string; c: string };
      try {
        // Base64url decode
        let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const decoded = atob(b64);
        payload = JSON.parse(decoded);
      } catch {
        return new Response('Invalid stream token', { status: 400 });
      }

      const { b: baseUrl, c: cookie } = payload;
      if (!baseUrl || !isAllowedUrl(baseUrl)) {
        return new Response('Disallowed upstream host', { status: 403 });
      }

      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const cleanPath = subpath.startsWith('/') ? subpath.slice(1) : subpath;
      const targetUrl = `${cleanBase}${cleanPath}`;

      const upstreamHeaders = new Headers(DOWNLOAD_HEADERS);
      if (cookie) {
        upstreamHeaders.set('Cookie', cookie);
      }
      const range = request.headers.get('range');
      if (range) {
        upstreamHeaders.set('Range', range);
      }

      const isSegment = cleanPath.endsWith('.m4s') || cleanPath.endsWith('.mp4');
      const isManifest = cleanPath.endsWith('.mpd');

      const fetchOptions: any = {
        headers: upstreamHeaders,
        cf: {
          cacheEverything: true,
          cacheTtl: isSegment ? 86400 : 3600, // Cache media chunks for 24h, manifest for 1h
        },
      };

      const upstreamRes = await fetch(targetUrl, fetchOptions);

      const respHeaders = new Headers(upstreamRes.headers);
      respHeaders.set('Access-Control-Allow-Origin', '*');
      respHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      respHeaders.set('Access-Control-Allow-Headers', '*');
      respHeaders.set('Accept-Ranges', 'bytes');

      if (isManifest) {
        respHeaders.set('Content-Type', 'application/dash+xml');
        respHeaders.set('Cache-Control', 'public, max-age=3600');
      } else if (isSegment) {
        respHeaders.set('Content-Type', 'video/iso.segment');
        respHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
      }

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: respHeaders,
      });
    }

    // 4. Direct MP4 Proxy: /proxy?url=...
    if (url.pathname === '/proxy') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl || !isAllowedUrl(targetUrl)) {
        return new Response('Invalid or disallowed video URL', { status: 400 });
      }

      const upstreamHeaders = new Headers(DOWNLOAD_HEADERS);
      const range = request.headers.get('range');
      if (range) {
        upstreamHeaders.set('Range', range);
      }

      const proxyFetchOptions: any = {
        headers: upstreamHeaders,
        cf: {
          cacheEverything: true,
          cacheTtl: 86400, // Cache MP4 content at edge for 24 hours for instant re-streaming & downloads
        },
      };

      const upstreamRes = await fetch(targetUrl, proxyFetchOptions);

      const respHeaders = new Headers(upstreamRes.headers);
      respHeaders.set('Access-Control-Allow-Origin', '*');
      respHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      respHeaders.set('Access-Control-Allow-Headers', '*');
      respHeaders.set('Accept-Ranges', 'bytes');
      // Signal to the browser/downstream to also cache for 24h
      respHeaders.set('Cache-Control', 'public, max-age=86400');

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: respHeaders,
      });
    }

    // 5. Generic embed relay: /embed?url=...&r=<referer>&ext=<marker>
    //    Carries arbitrary embed-CDN streams (found by the headless extractor)
    //    through Cloudflare's free/unmetered egress so the origin server uses no
    //    bandwidth. Injects the per-source hotlink Referer and rewrites HLS.
    if (url.pathname === '/embed') {
      const targetUrl = url.searchParams.get('url') || '';
      const referer = url.searchParams.get('r') || '';
      const ext = url.searchParams.get('ext') || '';
      if (!targetUrl || !isSafeExternalUrl(targetUrl)) {
        return new Response('Invalid or disallowed video URL', { status: 400 });
      }

      const upstreamHeaders = new Headers();
      upstreamHeaders.set(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      if (referer) {
        upstreamHeaders.set('Referer', referer);
        try {
          upstreamHeaders.set('Origin', new URL(referer).origin);
        } catch {
          /* ignore */
        }
      }
      const range = request.headers.get('range');
      if (range) upstreamHeaders.set('Range', range);

      // MPEG-DASH manifests are fetched as text and rewritten so all segment
      // references resolve back through /es/<token> here (hotlink headers are
      // then re-added on every segment request).
      if (looksLikeMpd(targetUrl) || ext === '.mpd') {
        const res = await fetch(targetUrl, { headers: upstreamHeaders, redirect: 'follow' });
        const finalUrl = res.url || targetUrl;
        const text = await res.text();
        const h = corsHeaders();
        h.set('Content-Type', 'application/dash+xml');
        h.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        if (res.status !== 200 || !/<MPD/i.test(text)) {
          return new Response('Failed to fetch DASH manifest', { status: res.status || 502, headers: h });
        }
        const token = encodeDashToken({ r: referer });
        return new Response(rewriteDashManifest(text, finalUrl, referer, token), { status: 200, headers: h });
      }

      // HLS manifests are fetched as text and rewritten (recursively).
      if (looksLikeM3u8(targetUrl) || ext === '.m3u8') {
        const res = await fetch(targetUrl, { headers: upstreamHeaders, redirect: 'follow' });
        const finalUrl = res.url || targetUrl;
        const text = await res.text();
        const proxyBase = `${url.protocol}//${url.host}/embed`;
        const h = corsHeaders();
        h.set('Content-Type', 'application/vnd.apple.mpegurl');
        h.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        if (res.status !== 200 || !text.startsWith('#EXTM3U')) {
          return new Response('Failed to fetch HLS manifest', { status: res.status || 502, headers: h });
        }
        return new Response(rewriteHlsManifest(text, finalUrl, referer, proxyBase), { status: 200, headers: h });
      }

      // Only true discrete media segments (.m4s, .ts) are edge-cached.
      // Continuous dynamic multi-gigabyte files (like Telegram proxy-file) must NEVER use cacheEverything
      const isSegment = /\.(m4s|ts)(\?|$)/i.test(targetUrl);
      const relayOptions: any = {
        headers: upstreamHeaders,
        redirect: 'follow',
        ...(isSegment ? { cf: { cacheEverything: true, cacheTtl: 86400 } } : {}),
      };
      const upstreamRes = await fetch(targetUrl, relayOptions);

      const respHeaders = new Headers(upstreamRes.headers);
      respHeaders.set('Access-Control-Allow-Origin', '*');
      respHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      respHeaders.set('Access-Control-Allow-Headers', '*');
      respHeaders.set('Accept-Ranges', 'bytes');
      if (isSegment) respHeaders.set('Cache-Control', 'public, max-age=86400');

      return new Response(upstreamRes.body, { status: upstreamRes.status, headers: respHeaders });
    }

    // 6. DASH segment relay: /es/<token>/<upstream-host>/<path>?<query>
    //    Rewritten manifests point every init/media segment here so the CDN's
    //    hotlink Referer is present on each byte-range request and CORS is fine.
    if (url.pathname.startsWith('/es/')) {
      const rest = url.pathname.slice('/es/'.length);
      const slashIdx = rest.indexOf('/');
      const token = slashIdx === -1 ? '' : rest.slice(0, slashIdx);
      const hostPath = slashIdx === -1 ? '' : rest.slice(slashIdx + 1);
      if (!token || !hostPath) {
        return new Response('Missing segment reference', { status: 400 });
      }
      const payload = decodeDashToken(token) || {};
      const targetUrl = `https://${hostPath}${url.search}`;
      if (!isSafeExternalUrl(targetUrl)) {
        return new Response('Disallowed segment host', { status: 403 });
      }

      const segHeaders = new Headers();
      segHeaders.set(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      if (payload.r) {
        segHeaders.set('Referer', payload.r);
        try {
          segHeaders.set('Origin', new URL(payload.r).origin);
        } catch {
          /* ignore */
        }
      }
      const range = request.headers.get('range');
      if (range) segHeaders.set('Range', range);

      const segFetchOptions: any = {
        headers: segHeaders,
        redirect: 'follow',
        cf: { cacheEverything: true, cacheTtl: 86400 },
      };
      const res = await fetch(targetUrl, segFetchOptions);

      const respHeaders = new Headers(res.headers);
      respHeaders.set('Access-Control-Allow-Origin', '*');
      respHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      respHeaders.set('Access-Control-Allow-Headers', '*');
      respHeaders.set('Accept-Ranges', 'bytes');
      return new Response(res.body, { status: res.status, headers: respHeaders });
    }

    // 7. Ultra-High Performance Telegram Chunk Edge-Caching Relay: /tg/:fileId or /telegram/:fileId
    if (url.pathname.startsWith('/tg/') || url.pathname.startsWith('/telegram/')) {
      const parts = url.pathname.replace(/^\/(tg|telegram)\//, '').split('/');
      const fileId = decodeURIComponent(parts[0]);
      if (!fileId) {
        return new Response('Missing Telegram fileId', { status: 400 });
      }

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      const rangeHeader = request.headers.get('range') || 'full';
      // Deterministic Edge Cache Key for this file chunk
      const cacheUrl = `https://cinestream-edge.internal/tg/${encodeURIComponent(fileId)}/${encodeURIComponent(rangeHeader)}`;
      const cacheKey = new Request(cacheUrl, { method: 'GET' });
      const cache = (caches as any).default;

      // --- 1. Check Cloudflare Edge Memory / SSD Cache ---
      try {
        const cachedRes = await cache.match(cacheKey);
        if (cachedRes) {
          const cachedBuf = await cachedRes.arrayBuffer();
          const contentRange = cachedRes.headers.get('X-Stored-Content-Range') || cachedRes.headers.get('Content-Range');
          const contentType = cachedRes.headers.get('Content-Type') || 'video/mp4';

          const hitHeaders = new Headers();
          hitHeaders.set('Content-Type', contentType);
          hitHeaders.set('Accept-Ranges', 'bytes');
          hitHeaders.set('Access-Control-Allow-Origin', '*');
          hitHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          hitHeaders.set('Access-Control-Allow-Headers', '*');
          hitHeaders.set('Cache-Control', 'public, max-age=604800, immutable');
          hitHeaders.set('X-Edge-Cache', 'HIT');
          hitHeaders.set('Content-Length', String(cachedBuf.byteLength));

          if (contentRange) {
            hitHeaders.set('Content-Range', contentRange);
            return new Response(cachedBuf, { status: 206, headers: hitHeaders });
          }
          return new Response(cachedBuf, { status: 200, headers: hitHeaders });
        }
      } catch (cacheErr) {
        // Continue to fetch if cache lookup fails
      }

      // --- 2. Cache Miss: Fetch chunk from origin backend with Keep-Alive ---
      const backendOrigin = (env.ORIGIN_URL || 'https://moviebuzz-server.onrender.com').replace(/\/+$/, '');
      const targetUrl = `${backendOrigin}/api/media/proxy-file/${encodeURIComponent(fileId)}?direct=true`;

      const upstreamHeaders = new Headers();
      upstreamHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CineStream-Edge/1.0');
      upstreamHeaders.set('Connection', 'keep-alive');
      if (rangeHeader !== 'full') {
        upstreamHeaders.set('Range', rangeHeader);
      }

      const upstreamRes = await fetch(targetUrl, {
        headers: upstreamHeaders,
        redirect: 'follow',
      });

      if (upstreamRes.status === 200 || upstreamRes.status === 206) {
        const buf = await upstreamRes.arrayBuffer();
        const contentRange = upstreamRes.headers.get('Content-Range') || '';
        const contentType = upstreamRes.headers.get('Content-Type') || 'video/mp4';

        const clientHeaders = new Headers();
        clientHeaders.set('Content-Type', contentType);
        clientHeaders.set('Accept-Ranges', 'bytes');
        clientHeaders.set('Access-Control-Allow-Origin', '*');
        clientHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        clientHeaders.set('Access-Control-Allow-Headers', '*');
        clientHeaders.set('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
        clientHeaders.set('X-Edge-Cache', 'MISS');
        clientHeaders.set('Content-Length', String(buf.byteLength));
        if (contentRange) {
          clientHeaders.set('Content-Range', contentRange);
        }

        // Store into Cloudflare edge cache asynchronously as 200 with X-Stored-Content-Range metadata
        try {
          const storeHeaders = new Headers();
          storeHeaders.set('Content-Type', contentType);
          storeHeaders.set('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
          if (contentRange) {
            storeHeaders.set('X-Stored-Content-Range', contentRange);
          }
          const responseToCache = new Response(buf, { status: 200, headers: storeHeaders });
          ctx.waitUntil(cache.put(cacheKey, responseToCache));
        } catch (err) {
          // ignore cache put errors
        }

        return new Response(buf, {
          status: upstreamRes.status,
          headers: clientHeaders,
        });
      }

      // Pass through errors if origin fails
      const errHeaders = new Headers(upstreamRes.headers);
      errHeaders.set('Access-Control-Allow-Origin', '*');
      return new Response(upstreamRes.body, { status: upstreamRes.status, headers: errHeaders });
    }

    return new Response('Not Found', { status: 404 });
  },
};
