import { Request, Response } from 'express';
import http from 'http';
import https from 'https';
import axios from 'axios';
import { movieboxService } from '../services/movieboxService';

// Persistent HTTP/HTTPS connection pooling to prevent TLS handshake overhead on every DASH segment
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const streamClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 30000,
});

// Fast in-memory cache for manifests (.mpd) and initialization headers (init-*.m4s)
interface CachedSegmentHeader {
  contentType: string;
  data: Buffer;
  timestamp: number;
}
const manifestInitCache = new Map<string, CachedSegmentHeader>();

// Whitelist of allowed upstream CDN domains to prevent SSRF
const ALLOWED_STREAM_DOMAINS = [
  'aoneroom.com',
  'hakunaymatata.com',
  'vegamovies.pet',
  'vegamovies',
  'inmoviebox.com',
  'fmoviesunblocked.net',
  'sportslive.wine',
];

const DOWNLOAD_HEADERS = {
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

function formatStreamingSources(sources: any[], baseUrl: string) {
  const seenQualities = new Map<string, number>();

  return sources.map((s) => {
    const isDash = s.format === 'DASH' || s.isDash || Boolean(s.dashManifestUrl);
    let streamUrl = '';

    const streamProxyBase = process.env.CLOUDFLARE_STREAM_PROXY_URL
      ? process.env.CLOUDFLARE_STREAM_PROXY_URL.replace(/\/+$/, '')
      : `${baseUrl}/api/streaming`;

    if (isDash && s.dashBaseUrl && s.signCookie) {
      const token = Buffer.from(
        JSON.stringify({ b: s.dashBaseUrl, c: s.signCookie })
      ).toString('base64url');
      streamUrl = `${streamProxyBase}/dash/${token}/index.mpd`;
    } else if (s.resourceLink) {
      streamUrl = `${streamProxyBase}/proxy?url=${encodeURIComponent(s.resourceLink)}`;
    }

    const rawRes = parseInt(String(s.resolution).replace(/\D/g, '') || '720', 10);
    const baseLabel = rawRes >= 1080 ? '1080p' : rawRes >= 720 ? '720p' : `${rawRes}p`;

    const count = (seenQualities.get(baseLabel) || 0) + 1;
    seenQualities.set(baseLabel, count);
    const qualityLabel = count === 1 ? (s.quality || baseLabel) : `${baseLabel} (Option ${count})`;

    return {
      resourceId: s.resourceId,
      quality: qualityLabel,
      resolution: `${rawRes}p`,
      codecName: s.codecName,
      fileSize: s.size ? `${(s.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Standard',
      streamUrl,
      rawStreamUrl: s.resourceLink,
      format: isDash ? 'DASH' : 'MP4',
      mimeType: isDash ? 'application/dash+xml' : 'video/mp4',
      season: s.season,
      episode: s.episode,
      duration: s.duration,
      provider: 'moviebox',
    };
  });
}

function formatStreamingSource(s: any, baseUrl: string) {
  return formatStreamingSources([s], baseUrl)[0];
}

/**
 * GET /api/streaming/search?q=movie-title&type=movie|series
 */
export const searchStreaming = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) {
      return res.status(400).json({ error: 'Search query parameter "q" is required.' });
    }

    const type = (req.query.type as string || 'all').toLowerCase();
    const validTypes = ['movie', 'series', 'all'];
    const chosenType = validTypes.includes(type) ? (type as any) : 'all';

    const results = await movieboxService.search(q, chosenType);
    return res.json(results);
  } catch (error: any) {
    console.error('searchStreaming error:', error.message);
    return res.status(502).json({ error: 'Upstream search service failed.', details: error.message });
  }
};

/**
 * GET /api/streaming/movies/:id/sources
 */
export const getMovieSources = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Movie subject ID is required.' });
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const sourcesRes = await movieboxService.getSources(id);
    const rawSources: any[] = sourcesRes.sources || [];

    const formattedSources = formatStreamingSources(rawSources, baseUrl);

    return res.json({
      subjectId: id,
      count: formattedSources.length,
      sources: formattedSources,
    });
  } catch (error: any) {
    console.error('getMovieSources error:', error.message);
    return res.status(502).json({ error: 'Failed to resolve movie sources.', details: error.message });
  }
};

/**
 * GET /api/streaming/series/:id/seasons
 */
export const getSeriesSeasons = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Series subject ID is required.' });
    }

    const seasonsRes = await movieboxService.getSeasons(id);
    return res.json(seasonsRes);
  } catch (error: any) {
    console.error('getSeriesSeasons error:', error.message);
    return res.status(502).json({ error: 'Failed to fetch series seasons.', details: error.message });
  }
};

/**
 * GET /api/streaming/episodes/:id/sources?season=1&episode=1
 */
export const getEpisodeSources = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const season = parseInt(req.query.season as string || '1', 10);
    const episode = parseInt(req.query.episode as string || '1', 10);

    if (!id) {
      return res.status(400).json({ error: 'Series subject ID is required.' });
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const sourcesRes = await movieboxService.getSources(id, season, episode);
    const rawSources: any[] = sourcesRes.sources || [];

    const formattedSources = formatStreamingSources(rawSources, baseUrl);

    return res.json({
      subjectId: id,
      season,
      episode,
      count: formattedSources.length,
      sources: formattedSources,
    });
  } catch (error: any) {
    console.error('getEpisodeSources error:', error.message);
    return res.status(502).json({ error: 'Failed to resolve episode sources.', details: error.message });
  }
};

/**
 * GET /api/streaming/resolve?title=Avatar&year=2009&type=movie|series&season=1&episode=1
 */
export const resolveStreamingSources = async (req: Request, res: Response) => {
  try {
    const title = (req.query.title as string || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Title parameter is required.' });
    }

    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const type = (req.query.type as string || 'movie') === 'series' ? 'series' : 'movie';
    const season = parseInt(req.query.season as string || '1', 10);
    const episode = parseInt(req.query.episode as string || '1', 10);

    const resolved = await movieboxService.resolveByTitle(title, year, type, season, episode);
    if (!resolved || !resolved.sources.length) {
      return res.status(404).json({ message: 'No streaming sources available for this title.' });
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const formattedSources = formatStreamingSources(resolved.sources, baseUrl);

    return res.json({
      subject: resolved.subject,
      sources: formattedSources,
    });
  } catch (error: any) {
    console.error('resolveStreamingSources error:', error.message);
    return res.status(502).json({ error: 'Failed to resolve stream sources.', details: error.message });
  }
};

/**
 * GET /api/streaming/dash/:token/*
 * Streams upstream MPEG-DASH manifests and .m4s audio/video segments.
 * Injects CDN authentication headers and signed Edge-Cache-Cookies.
 */
export const proxyDashStream = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const subpath = req.params[0]; // e.g. "index.mpd", "init-stream0.m4s", "chunk-stream0-00001.m4s"

    if (!token || !subpath) {
      return res.status(400).json({ error: 'Token and subpath are required.' });
    }

    let payload: { b: string; c: string };
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      payload = JSON.parse(decoded);
    } catch {
      return res.status(400).json({ error: 'Invalid DASH stream token.' });
    }

    const { b: baseUrl, c: cookie } = payload;
    if (!baseUrl || !isAllowedUrl(baseUrl)) {
      return res.status(400).json({ error: 'Disallowed upstream stream host.' });
    }

    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const cleanPath = subpath.startsWith('/') ? subpath.slice(1) : subpath;
    const targetUrl = `${cleanBase}${cleanPath}`;

    const isManifest = cleanPath.endsWith('.mpd');
    const isInitSegment = cleanPath.startsWith('init-') && cleanPath.endsWith('.m4s');

    // Return cached manifest or initialization header immediately in 0ms
    if (isManifest || isInitSegment) {
      const cached = manifestInitCache.get(targetUrl);
      if (cached && Date.now() - cached.timestamp < 3600000) {
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', String(cached.data.length));
        return res.status(200).send(cached.data);
      }
    }

    const requestHeaders: Record<string, string> = {
      'User-Agent': DOWNLOAD_HEADERS['User-Agent'],
      'Referer': 'https://sportslive.wine',
    };
    if (cookie) {
      requestHeaders['Cookie'] = cookie;
    }
    if (req.headers.range) {
      requestHeaders['Range'] = req.headers.range;
    }

    // For manifest and init headers, buffer in memory to cache
    if (isManifest || isInitSegment) {
      const upstreamRes = await streamClient.get(targetUrl, {
        headers: requestHeaders,
        responseType: 'arraybuffer',
        validateStatus: () => true,
        timeout: 25000,
      });

      if (upstreamRes.status === 200) {
        const contentType = isManifest
          ? 'application/dash+xml'
          : String(upstreamRes.headers['content-type'] || 'video/iso.segment');
        const buf = Buffer.from(upstreamRes.data);
        manifestInitCache.set(targetUrl, {
          contentType,
          data: buf,
          timestamp: Date.now(),
        });

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', String(buf.length));
        return res.status(200).send(buf);
      }
    }

    // For media chunks, stream with persistent keep-alive connection
    const upstreamRes = await streamClient.get(targetUrl, {
      headers: requestHeaders,
      responseType: 'stream',
      validateStatus: () => true,
      timeout: 30000,
    });

    res.status(upstreamRes.status);

    if (cleanPath.endsWith('.mpd')) {
      res.setHeader('Content-Type', 'application/dash+xml');
    } else if (cleanPath.endsWith('.m4s') || cleanPath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/iso.segment');
    } else if (upstreamRes.headers['content-type']) {
      res.setHeader('Content-Type', String(upstreamRes.headers['content-type']));
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (upstreamRes.headers['content-range']) {
      res.setHeader('Content-Range', String(upstreamRes.headers['content-range']));
    }
    if (upstreamRes.headers['content-length']) {
      res.setHeader('Content-Length', String(upstreamRes.headers['content-length']));
    }

    upstreamRes.data.pipe(res);

    req.on('close', () => {
      if (upstreamRes.data && typeof upstreamRes.data.destroy === 'function') {
        upstreamRes.data.destroy();
      }
    });
  } catch (error: any) {
    console.error('proxyDashStream error:', error.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to proxy DASH segment.' });
    }
  }
};

/**
 * GET /api/streaming/proxy?url=...
 * Streaming byte-range proxy that streams upstream MP4 files with seeking, CORS, and header injection.
 */
export const proxyVideoStream = async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || !isAllowedUrl(targetUrl)) {
    return res.status(400).json({ error: 'Invalid or disallowed video URL.' });
  }

  const range = req.headers.range;
  const requestHeaders: Record<string, string> = { ...DOWNLOAD_HEADERS };
  if (range) {
    requestHeaders['Range'] = range;
  }

  try {
    const upstreamRes = await streamClient.get(targetUrl, {
      headers: requestHeaders,
      responseType: 'stream',
      validateStatus: () => true,
      timeout: 30000,
    });

    res.status(upstreamRes.status);

    // Forward range and media headers
    res.setHeader('Content-Type', String(upstreamRes.headers['content-type'] || 'video/mp4'));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (upstreamRes.headers['content-range']) {
      res.setHeader('Content-Range', String(upstreamRes.headers['content-range']));
    }
    if (upstreamRes.headers['content-length']) {
      res.setHeader('Content-Length', String(upstreamRes.headers['content-length']));
    }

    upstreamRes.data.pipe(res);

    req.on('close', () => {
      if (upstreamRes.data && typeof upstreamRes.data.destroy === 'function') {
        upstreamRes.data.destroy();
      }
    });
  } catch (error: any) {
    console.error('proxyVideoStream error:', error.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to fetch upstream video chunk.' });
    }
  }
};

/**
 * GET /api/streaming/subtitle?url=...
 * Proxies subtitle file and converts SubRip (.srt) to WebVTT (.vtt) on the fly for standard HTML5 <track>.
 */
export const proxySubtitle = async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || !isAllowedUrl(targetUrl)) {
    return res.status(400).json({ error: 'Invalid or disallowed subtitle URL.' });
  }

  try {
    const response = await axios.get(targetUrl, {
      responseType: 'text',
      timeout: 10000,
    });

    const srtText: string = response.data || '';
    // SRT to WebVTT conversion (replace commas in timestamps with dots and prepend WEBVTT)
    const vttContent = srtText.startsWith('WEBVTT')
      ? srtText
      : `WEBVTT\n\n${srtText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(vttContent);
  } catch (error: any) {
    console.error('proxySubtitle error:', error.message);
    return res.status(502).json({ error: 'Failed to fetch subtitle.' });
  }
};
