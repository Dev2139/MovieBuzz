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
        respHeaders.set('Cache-Control', 'public, max-age=86400');
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

      const upstreamRes = await fetch(targetUrl, {
        headers: upstreamHeaders,
      });

      const respHeaders = new Headers(upstreamRes.headers);
      respHeaders.set('Access-Control-Allow-Origin', '*');
      respHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      respHeaders.set('Accept-Ranges', 'bytes');

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: respHeaders,
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
