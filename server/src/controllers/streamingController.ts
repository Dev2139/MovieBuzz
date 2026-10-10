import { Request, Response } from 'express';
import axios from 'axios';
import { movieboxService } from '../services/movieboxService';

// Whitelist of allowed upstream CDN domains to prevent SSRF
const ALLOWED_STREAM_DOMAINS = [
  'aoneroom.com',
  'hakunaymatata.com',
  'vegamovies.pet',
  'vegamovies',
  'inmoviebox.com',
  'fmoviesunblocked.net',
];

const DOWNLOAD_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
  Referer: 'https://fmoviesunblocked.net/',
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

    // Map each source to authorized proxy stream URLs
    const formattedSources = rawSources.map((s) => ({
      resourceId: s.resourceId,
      quality: s.quality || `${s.resolution}p`,
      resolution: `${s.resolution}p`,
      codecName: s.codecName,
      fileSize: s.size ? `${(s.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Standard',
      streamUrl: `${baseUrl}/api/streaming/proxy?url=${encodeURIComponent(s.resourceLink)}`,
      rawStreamUrl: s.resourceLink,
      duration: s.duration,
      provider: 'moviebox',
    }));

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

    const formattedSources = rawSources.map((s) => ({
      resourceId: s.resourceId,
      quality: s.quality || `${s.resolution}p`,
      resolution: `${s.resolution}p`,
      codecName: s.codecName,
      fileSize: s.size ? `${(s.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Standard',
      streamUrl: `${baseUrl}/api/streaming/proxy?url=${encodeURIComponent(s.resourceLink)}`,
      rawStreamUrl: s.resourceLink,
      season: s.season || season,
      episode: s.episode || episode,
      duration: s.duration,
      provider: 'moviebox',
    }));

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

    const formattedSources = resolved.sources.map((s: any) => ({
      resourceId: s.resourceId,
      quality: s.quality || `${s.resolution}p`,
      resolution: `${s.resolution}p`,
      codecName: s.codecName,
      fileSize: s.size ? `${(s.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Standard',
      streamUrl: `${baseUrl}/api/streaming/proxy?url=${encodeURIComponent(s.resourceLink)}`,
      rawStreamUrl: s.resourceLink,
      duration: s.duration,
      provider: 'moviebox',
    }));

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
    const upstreamRes = await axios.get(targetUrl, {
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
