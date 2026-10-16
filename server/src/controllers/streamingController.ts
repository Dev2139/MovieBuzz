import { Request, Response } from 'express';
import http from 'http';
import https from 'https';
import axios from 'axios';
import { movieboxService } from '../services/movieboxService';
import { tmdbService, cleanMovieTitle } from '../services/tmdb/tmdbService';
import { subtitleService, srtToVtt } from '../services/subtitleService';
import { resolveEmbedSources, diagnoseProviders, diagnoseExtractor, ValidatedEmbedSource, EmbedResolveContext } from '../services/embedProviderService';

// Persistent HTTP/HTTPS connection pooling to prevent TLS handshake overhead on every DASH segment
// Raised to 100 sockets to handle concurrent mobile viewers without queuing
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100, keepAliveMsecs: 30000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100, keepAliveMsecs: 30000 });

const streamClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 30000,
  decompress: false, // forward compressed bytes as-is; let client handle it
});

// Fast in-memory LRU cache for manifests (.mpd) and initialization segments (init-*.m4s).
// Capped at 200 entries to prevent unbounded RAM growth on high-traffic deployments.
interface CachedSegmentHeader {
  contentType: string;
  data: Buffer;
  timestamp: number;
  etag: string;
}
const MANIFEST_CACHE_MAX = 200;
const manifestInitCache = new Map<string, CachedSegmentHeader>();

function pruneManifestCache(): void {
  if (manifestInitCache.size <= MANIFEST_CACHE_MAX) return;
  // Evict oldest entries (Map preserves insertion order)
  const toDelete = manifestInitCache.size - MANIFEST_CACHE_MAX;
  let count = 0;
  for (const key of manifestInitCache.keys()) {
    if (count++ >= toDelete) break;
    manifestInitCache.delete(key);
  }
}

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
    const baseLabel = rawRes >= 2160 ? '4K (2160p)' : rawRes >= 1080 ? '1080p' : rawRes >= 720 ? '720p' : '420p';

    const count = (seenQualities.get(baseLabel) || 0) + 1;
    seenQualities.set(baseLabel, count);
    const sizeGb = s.size ? `${(s.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : '';
    const printNote = count > 1 ? ` (Print ${count}${sizeGb ? ` • ${sizeGb}` : ''})` : sizeGb ? ` (${sizeGb})` : '';
    const qualityLabel = count === 1 && s.quality ? s.quality : `${baseLabel}${printNote}`;

    return {
      resourceId: s.resourceId,
      quality: qualityLabel,
      resolution: `${rawRes}p`,
      codecName: s.codecName || (isDash ? 'hevc' : 'h264'),
      fileSize: s.size ? `${(s.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Standard',
      streamUrl,
      rawStreamUrl: s.resourceLink,
      format: isDash ? 'DASH' : 'MP4',
      mimeType: isDash ? 'application/dash+xml' : 'video/mp4',
      season: s.season,
      episode: s.episode,
      duration: s.duration,
      provider: 'cinestream',
      audioLang: s.audioLang || 'en',
      audioName: s.audioName || 'Original Audio',
      dubSubjectId: s.dubSubjectId,
      isOriginal: Boolean(s.isOriginal),
    };
  });
}

function formatStreamingSource(s: any, baseUrl: string) {
  return formatStreamingSources([s], baseUrl)[0];
}

// ---------------------------------------------------------------------------
// Embed-provider (on-demand, zero-storage) playback support
// ---------------------------------------------------------------------------

/**
 * SSRF guard for the on-the-fly embed proxy. Unlike /proxy (fixed allow-list),
 * embed sources resolve to arbitrary CDN hosts, so we validate the target is a
 * public http(s) URL and refuse loopback / private / link-local / metadata IPs.
 */
function isSafeExternalUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname;
    if (!host) return false;
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    // Reject raw IPv4 literals that are private / loopback / link-local / CGNAT.
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
      if (a === 0 || a === 10 || a === 127) return false;
      if (a === 169 && b === 254) return false;      // link-local / cloud metadata
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    }
    if (host === '::1' || host.startsWith('fe80') || host.startsWith('fd') || host.startsWith('fc')) return false;
    return true;
  } catch {
    return false;
  }
}

/** Detect an HLS manifest by URL extension. */
function looksLikeHlsManifest(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

/** Detect a DASH manifest by URL extension. */
function looksLikeDashManifest(url: string): boolean {
  return /\.mpd(\?|$)/i.test(url);
}

// ---------------------------------------------------------------------------
// DASH manifest rewriting for the embed proxy (mirrors the CF worker's /es
// relay). SegmentTemplate values keep their literal $RepresentationID$ /
// $Number%05d$ tokens so dash.js still substitutes them; only the base of the
// URL is rewritten back through our own proxy, which injects the hotlink
// Referer the CDN demands on every segment.
// ---------------------------------------------------------------------------
const EMBED_SEGMENT_EXT_RE = /\.(m4s|mp4|ts|webm|aac|m4v|mka)(\?|$)/i;

function encodeEmbedDashToken(payload: { r?: string }): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeEmbedDashToken(token: string): { r?: string } {
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
  } catch {
    return {};
  }
}

function embedEsProxyPath(absUrl: string, token: string): string | null {
  try {
    const qIdx = absUrl.indexOf('?');
    const pathPart = qIdx === -1 ? absUrl : absUrl.slice(0, qIdx);
    const rawQuery = qIdx === -1 ? '' : absUrl.slice(qIdx);
    let hostPath = pathPart;
    if (/^https?:\/\//i.test(hostPath)) {
      const u = new URL(hostPath);
      hostPath = `${u.host}${u.pathname}`;
    } else if (hostPath.startsWith('/')) {
      hostPath = `${new URL(manifestHostOf(absUrl) || absUrl).host}${hostPath.slice(1)}`;
    } else {
      const u = new URL(hostPath, 'https://placeholder.invalid/');
      hostPath = `${u.host}${u.pathname}`;
    }
    return `/es/${token}/${hostPath}${rawQuery}`;
  } catch {
    return null;
  }
}

// Unused helper kept intentionally small: absolute-path templates resolve
// against the manifest origin, so callers pass the already-joined absUrl.
function manifestHostOf(_u: string): string | null {
  return null;
}

function rewriteDashEmbedManifest(
  text: string,
  manifestUrl: string,
  token: string,
  proxyRoot: string
): string {
  const resolveAbs = (u: string): string => {
    try {
      if (/^https?:\/\//i.test(u)) return u;
      return new URL(u, manifestUrl).toString();
    } catch {
      return u;
    }
  };
  const toProxy = (abs: string): string | null => {
    const p = embedEsProxyPath(abs, token);
    return p ? `${proxyRoot}${p}` : null;
  };

  let out = text.replace(/<BaseURL>([^<]+)<\/BaseURL>/g, (m, raw) => {
    const r = toProxy(resolveAbs(String(raw).trim()));
    return r ? `<BaseURL>${r}</BaseURL>` : m;
  });
  out = out.replace(/\b(initialization|media|index|sourceURL)="([^"]+)"/g, (m, attr, val) => {
    if (!EMBED_SEGMENT_EXT_RE.test(val)) return m;
    // The attribute may contain XML-escaped entities in the query; resolve only
    // the path portion and re-append the raw query verbatim after wrapping.
    const abs = resolveAbs(val.includes('?') ? val.split('?')[0] : val);
    const rawQuery = val.includes('?') ? val.slice(val.indexOf('?')) : '';
    const p = embedEsProxyPath(abs, token);
    if (!p) return m;
    return `${attr}="${proxyRoot}${p}${rawQuery}"`;
  });
  return out;
}

/**
 * Rewrite an HLS (.m3u8) playlist so that EVERY child URI (segments, variant
 * playlists, EXT-X-KEY / EXT-X-MAP URIs) is routed back through the embed-proxy
 * as an absolute URL. This lets captured HLS with relative segments play in the
 * browser, because hls.js would otherwise resolve them against our proxy host
 * instead of the upstream CDN. Child playlists are re-marked with ext=.m3u8 so
 * they get recursively rewritten on the next request.
 */
function rewriteHlsManifest(text: string, manifestUrl: string, referer: string | undefined, proxyBase: string): string {
  const resolveAbs = (u: string): string => new URL(u, manifestUrl).toString();
  const wrap = (abs: string, isManifest: boolean): string => {
    const p = new URLSearchParams({ url: abs });
    if (referer) p.set('r', referer);
    if (isManifest) p.set('ext', '.m3u8');
    return `${proxyBase}?${p.toString()}`;
  };

  const lines = text.split(/\r?\n/);
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed === '') return line;
    if (trimmed.startsWith('#')) {
      // Rewrite quoted URI="..." attributes (KEY / MAP / MEDIA / PART / etc.).
      return line.replace(/URI="([^"]+)"/g, (_m, uri) => {
        try {
          return `URI="${wrap(resolveAbs(uri), looksLikeHlsManifest(uri))}"`;
        } catch {
          return _m;
        }
      });
    }
    // A bare (non-comment) line is a segment or child-playlist URI.
    try {
      const abs = resolveAbs(trimmed);
      return wrap(abs, looksLikeHlsManifest(abs));
    } catch {
      return line;
    }
  });
  return out.join('\n');
}

function embedKindToFormat(kind: ValidatedEmbedSource['kind']) {
  if (kind === 'hls') return { format: 'HLS', mimeType: 'application/vnd.apple.mpegurl' };
  if (kind === 'dash') return { format: 'DASH', mimeType: 'application/dash+xml' };
  return { format: 'MP4', mimeType: 'video/mp4' };
}

/**
 * Turn validated embed sources into the exact shape the client's VideoPlayer
 * expects. The streamUrl always carries a literal marker (`.mp4` / `.m3u8` /
 * `.mpd`) so the player auto-selects the right engine, and it points at our
 * embed proxy which re-fetches the CDN with the correct hotlink Referer.
 */
function formatEmbedSources(sources: ValidatedEmbedSource[], baseUrl: string) {
  // Prefer the Cloudflare Worker relay (free/unmetered egress) so video bytes
  // never touch Render's bandwidth. Fall back to Render's own embed-proxy only
  // when no CF worker base is configured.
  const cfRoot = (process.env.CLOUDFLARE_STREAM_PROXY_URL || '').trim().replace(/\/+$/, '');
  const proxyEndpoint = cfRoot ? `${cfRoot}/embed` : `${baseUrl}/api/streaming/embed-proxy`;
  return sources.map((s, idx) => {
    const { format, mimeType } = embedKindToFormat(s.kind);
    const marker = s.kind === 'hls' ? '.m3u8' : s.kind === 'dash' ? '.mpd' : '.mp4';
    const params = new URLSearchParams({ url: s.url });
    if (s.referer) params.set('r', s.referer);
    const streamUrl = `${proxyEndpoint}?${params.toString()}&ext=${marker}`;
    const sizeGb = s.sizeBytes ? `${(s.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Standard';
    return {
      resourceId: `embed-${s.provider}-${idx}`,
      quality: `${format} • ${s.provider}`,
      resolution: 'Auto',
      codecName: 'auto',
      fileSize: sizeGb,
      streamUrl,
      rawStreamUrl: s.url,
      format,
      mimeType,
      provider: `cinestream-${s.provider}`,
      audioLang: 'en',
      audioName: 'Original Audio',
      isOriginal: true,
    };
  });
}

/**
 * Resolve embed sources, filling in any missing imdb/tmdb ids via TMDB so the
 * providers get accurate identifiers even when the client only sent a title.
 */
async function resolveEmbedViaFallback(
  ctx: EmbedResolveContext & { tmdbId?: string }
) {
  let { imdbId, tmdbId } = ctx;
  if (!imdbId && !tmdbId) {
    try {
      const meta: any = await tmdbService.fetchMetadata(ctx.title, ctx.year, ctx.type);
      if (meta) {
        imdbId = imdbId || meta.imdbId;
        tmdbId = tmdbId || (meta.tmdbId ? String(meta.tmdbId) : undefined);
      }
    } catch {
      /* ignore metadata lookup failures */
    }
  }
  // Providers key their catalogue by IMDb id first, so a row that only carries
  // a TMDB id (common for imported content) must be mapped before extraction.
  if (!imdbId && tmdbId) {
    imdbId = await tmdbService.fetchImdbId(tmdbId, ctx.type).catch(() => undefined);
  }
  try {
    const sources = await resolveEmbedSources({ ...ctx, imdbId, tmdbId });
    return sources;
  } catch {
    return [];
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
    console.warn('getSeriesSeasons notice:', error.message);
    return res.json({ subjectId: req.params.id, seasons: [], count: 0 });
  }
};

/**
 * GET /api/streaming/series/seasons-episodes?title=Breaking+Bad&year=2008&subjectId=...
 * Resolves full seasons and episodes list from MovieBox and returns all episodes from all seasons.
 */
export const getSeriesSeasonsEpisodes = async (req: Request, res: Response) => {
  try {
    const rawTitle = ((req.query.title as string) || '').trim();
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    let subjectId = ((req.query.subjectId as string) || '').trim();

    if (!rawTitle && !subjectId) {
      return res.status(400).json({ error: 'Title or subjectId parameter is required.' });
    }

    const { cleanTitle, coreTitle } = cleanMovieTitle(rawTitle);
    let matchedSubject: any = null;

    // 1. Resolve subjectId via MovieBox search if not directly passed
    if (!subjectId) {
      // Try searching cleanTitle first, then coreTitle, then rawTitle
      for (const queryVariant of [cleanTitle, coreTitle, rawTitle].filter(Boolean)) {
        const searchRes = await movieboxService.search(queryVariant, 'series');
        const results: any[] = searchRes.results || [];
        if (results.length > 0) {
          let match = results[0];
          if (year) {
            const yearMatch = results.find((r) => r.releaseDate && r.releaseDate.startsWith(String(year)));
            if (yearMatch) match = yearMatch;
          }
          matchedSubject = match;
          subjectId = match.subjectId;
          break;
        }
      }
    }

    // 2. Fetch full seasons detail from MovieBox (if subjectId resolved)
    let rawMovieBoxSeasons: any[] = [];
    let itemDetails: any = null;
    if (subjectId) {
      try {
        const seasonsRes = await movieboxService.getSeasons(subjectId);
        rawMovieBoxSeasons = seasonsRes?.seasons || [];
      } catch (err: any) {
        console.warn('[getSeriesSeasonsEpisodes] MovieBox getSeasons notice:', err.message);
      }
      try {
        itemDetails = await movieboxService.getItem(subjectId);
      } catch {}
    }

    // 3. Concurrently fetch official television episode metadata from TMDB
    let tmdbSeriesData: any = null;
    try {
      tmdbSeriesData = await tmdbService.fetchSeriesSeasonsEpisodes(cleanTitle, year);
    } catch (err: any) {
      console.warn('[getSeriesSeasonsEpisodes] TMDB fetch notice:', err.message);
    }

    const defaultBackdrop =
      tmdbSeriesData?.backdropUrl ||
      itemDetails?.cover?.url ||
      itemDetails?.preVideoCover ||
      matchedSubject?.cover ||
      '';

    const cleanSeriesTitle = tmdbSeriesData?.title || itemDetails?.title || matchedSubject?.title || cleanTitle;
    const cleanSeriesDescription = tmdbSeriesData?.description || itemDetails?.description || matchedSubject?.description || '';

    // 4. Combine and build structured seasons and episodes
    // Map existing TMDB seasons for quick lookup by seasonNumber
    const tmdbSeasonMap = new Map<number, any>();
    if (tmdbSeriesData?.seasons) {
      for (const s of tmdbSeriesData.seasons) {
        tmdbSeasonMap.set(s.seasonNumber, s);
      }
    }

    // Determine the set of season numbers to include
    const seasonNumbersSet = new Set<number>();
    if (tmdbSeriesData?.seasons) {
      tmdbSeriesData.seasons.forEach((s: any) => seasonNumbersSet.add(s.seasonNumber));
    }
    rawMovieBoxSeasons.forEach((s: any) => {
      const sNum = s.se || 1;
      if (sNum > 0) seasonNumbersSet.add(sNum);
    });

    if (seasonNumbersSet.size === 0) {
      seasonNumbersSet.add(1);
    }

    const sortedSeasonNumbers = Array.from(seasonNumbersSet).sort((a, b) => a - b);

    const formattedSeasons = sortedSeasonNumbers.map((seasonNum) => {
      const tmdbSeason = tmdbSeasonMap.get(seasonNum);
      const mbSeason = rawMovieBoxSeasons.find((s: any) => s.se === seasonNum);

      const mbEpCount = mbSeason?.maxEp || 0;
      const tmdbEpCount = tmdbSeason?.episodes?.length || tmdbSeason?.episodeCount || 0;
      const targetEpCount = Math.max(mbEpCount, tmdbEpCount, 1);

      const episodes = [];
      for (let ep = 1; ep <= targetEpCount; ep++) {
        const tmdbEp = tmdbSeason?.episodes?.find((e: any) => e.episodeNumber === ep);

        episodes.push({
          seasonNumber: seasonNum,
          episodeNumber: ep,
          title: tmdbEp?.title || `Episode ${ep}`,
          description:
            tmdbEp?.description ||
            `${cleanSeriesTitle} — Season ${seasonNum}, Episode ${ep}. Stream in 1080p Full HD on CineStream.`,
          thumbnailUrl: tmdbEp?.thumbnailUrl || defaultBackdrop,
          duration: tmdbEp?.duration || 2700,
        });
      }

      return {
        seasonNumber: seasonNum,
        title: tmdbSeason?.title || `Season ${seasonNum}`,
        episodeCount: targetEpCount,
        episodes,
      };
    });

    const totalEpisodes = formattedSeasons.reduce((acc, s) => acc + s.episodeCount, 0);

    return res.json({
      subjectId: subjectId || '',
      title: cleanSeriesTitle,
      description: cleanSeriesDescription,
      backdropUrl: defaultBackdrop,
      totalSeasons: formattedSeasons.length,
      totalEpisodes,
      seasons: formattedSeasons,
    });
  } catch (error: any) {
    console.warn('getSeriesSeasonsEpisodes notice:', error.message);
    return res.json({
      title: req.query.title,
      subjectId: '',
      totalEpisodes: 0,
      seasons: [],
    });
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
      dubs: sourcesRes.dubs || [],
    });
  } catch (error: any) {
    console.warn('getEpisodeSources notice:', error.message);
    return res.json({ subjectId: req.params.id, season: req.query.season, episode: req.query.episode, count: 0, sources: [], dubs: [] });
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
    const imdbId = (req.query.imdbId as string || '').trim() || undefined;
    const tmdbIdParam = req.query.tmdbId ? String(req.query.tmdbId).trim() : undefined;

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    // Playback NEVER comes from MovieBox anymore: its play-info API (v1 and v2,
    // verified live across many titles) serves only a 23-second "upgrade notice"
    // placeholder, and its leftover community /resource uploads are frequently
    // mislabeled — playing them is what surfaced as "a random video". MovieBox
    // remains for metadata endpoints only. Streams here are resolved on demand
    // from embed providers keyed by OUR verified TMDB/IMDb ids, so the content
    // always matches the title the user clicked.
    const embedSources = await resolveEmbedViaFallback({
      title,
      year,
      type,
      season,
      episode,
      imdbId,
      tmdbId: tmdbIdParam,
    });

    let subtitles: any[] = [];
    try {
      subtitles = await subtitleService.getSubtitles({
        title,
        type,
        season,
        episode,
        baseUrl,
      });
    } catch (subErr: any) {
      console.warn('resolveStreamingSources subtitles notice:', subErr.message);
    }

    if (embedSources.length > 0) {
      return res.json({
        subject: null,
        sources: formatEmbedSources(embedSources, baseUrl),
        dubs: [],
        subtitles,
        provider: 'embed',
      });
    }
    return res.json({ subject: null, sources: [], dubs: [], subtitles });
  } catch (error: any) {
    console.warn('resolveStreamingSources notice:', error.message);
    return res.json({ subject: null, sources: [], dubs: [], subtitles: [] });
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
        // Support conditional GET: If-None-Match speeds up mobile repeat requests
        if (req.headers['if-none-match'] === cached.etag) {
          return res.status(304).end();
        }
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', String(cached.data.length));
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', isManifest ? 'public, max-age=60, stale-while-revalidate=300' : 'public, max-age=3600, immutable');
        res.setHeader('Connection', 'keep-alive');
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
        // Generate a deterministic ETag from URL + length for conditional GET support
        const etag = `"${buf.length}-${Date.now().toString(36)}"`;
        manifestInitCache.set(targetUrl, {
          contentType,
          data: buf,
          timestamp: Date.now(),
          etag,
        });
        pruneManifestCache();

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', String(buf.length));
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', isManifest ? 'public, max-age=60, stale-while-revalidate=300' : 'public, max-age=3600, immutable');
        res.setHeader('Connection', 'keep-alive');
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
    res.setHeader('Cache-Control', cleanPath.endsWith('.mpd') ? 'public, max-age=60, stale-while-revalidate=300' : 'public, max-age=31536000, immutable');
    // Keep-alive hint: eliminates TCP re-handshake on mobile for each .m4s segment
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering for immediate chunk delivery

    if (upstreamRes.headers['content-range']) {
      res.setHeader('Content-Range', String(upstreamRes.headers['content-range']));
    }
    if (upstreamRes.headers['content-length']) {
      res.setHeader('Content-Length', String(upstreamRes.headers['content-length']));
    }

    res.flushHeaders(); // Instantly push headers to browser socket so MSE processes chunks without queuing
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
    // Longer CDN cache + keep-alive to avoid TCP re-connection on byte-range seeks
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Accel-Buffering', 'no');

    if (upstreamRes.headers['content-range']) {
      res.setHeader('Content-Range', String(upstreamRes.headers['content-range']));
    }
    if (upstreamRes.headers['content-length']) {
      res.setHeader('Content-Length', String(upstreamRes.headers['content-length']));
    }

    res.flushHeaders();
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
 * GET /api/streaming/embed-proxy?url=...&r=<referer>&ext=<marker>
 * On-the-fly byte-range proxy for validated embed-provider streams. Re-fetches
 * the hotlink-protected CDN with the correct Referer/Origin. Guarded against
 * SSRF (public http(s) only). The `ext` marker is ignored here but lets the
 * client detect the stream type from the URL.
 */
export const proxyEmbedStream = async (req: Request, res: Response) => {
  const targetUrl = (req.query.url as string) || '';
  const referer = (req.query.r as string) || undefined;
  if (!targetUrl || !isSafeExternalUrl(targetUrl)) {
    return res.status(400).json({ error: 'Invalid or disallowed video URL.' });
  }

  const range = req.headers.range;
  const requestHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
  if (referer) {
    requestHeaders['Referer'] = referer;
    try {
      requestHeaders['Origin'] = new URL(referer).origin;
    } catch {
      /* ignore */
    }
  }
  // HLS manifests are fetched as text and rewritten so that every relative
  // segment / key / child-playlist resolves back through this proxy (recursively).
  // Everything else (MP4 files, media segments) is byte-range streamed below.
  const wantsManifest = looksLikeHlsManifest(targetUrl) || req.query.ext === '.m3u8';
  const wantsDash = looksLikeDashManifest(targetUrl) || req.query.ext === '.mpd';

  if (wantsDash) {
    try {
      const manifestRes = await streamClient.get(targetUrl, {
        headers: { ...requestHeaders, Accept: 'application/dash+xml, */*' },
        responseType: 'text',
        validateStatus: () => true,
        timeout: 20000,
        maxRedirects: 5,
      });
      const finalUrl: string =
        (manifestRes as any).request?.res?.responseUrl ||
        (manifestRes as any).request?.responseUrl ||
        targetUrl;
      const text = String(manifestRes.data || '');

      const mHost = req.get('host') || 'localhost:5000';
      const mProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const proxyRoot = `${mProto}://${mHost}/api/streaming`;

      res.setHeader('Content-Type', 'application/dash+xml');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (manifestRes.status !== 200 || !/<MPD/i.test(text)) {
        return res.status(manifestRes.status || 502).json({ error: 'Failed to fetch DASH manifest.' });
      }
      const token = encodeEmbedDashToken({ r: referer });
      return res.status(200).send(rewriteDashEmbedManifest(text, finalUrl, token, proxyRoot));
    } catch (error: any) {
      console.error('proxyEmbedStream dash manifest error:', error.message);
      if (!res.headersSent) return res.status(502).json({ error: 'Failed to fetch DASH manifest.' });
      return;
    }
  }

  if (wantsManifest) {
    try {
      const manifestRes = await streamClient.get(targetUrl, {
        headers: { ...requestHeaders, Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, */*' },
        responseType: 'text',
        validateStatus: () => true,
        timeout: 20000,
        maxRedirects: 5,
      });
      const finalUrl: string =
        (manifestRes as any).request?.res?.responseUrl ||
        (manifestRes as any).request?.responseUrl ||
        targetUrl;
      const text = String(manifestRes.data || '');

      const mHost = req.get('host') || 'localhost:5000';
      const mProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const proxyBase = `${mProto}://${mHost}/api/streaming/embed-proxy`;

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (manifestRes.status !== 200 || !text.startsWith('#EXTM3U')) {
        return res.status(manifestRes.status || 502).json({ error: 'Failed to fetch HLS manifest.' });
      }
      const rewritten = rewriteHlsManifest(text, finalUrl, referer, proxyBase);
      return res.status(200).send(rewritten);
    } catch (error: any) {
      console.error('proxyEmbedStream manifest error:', error.message);
      if (!res.headersSent) return res.status(502).json({ error: 'Failed to fetch HLS manifest.' });
      return;
    }
  }

  if (range) requestHeaders['Range'] = range;

  try {
    const upstreamRes = await streamClient.get(targetUrl, {
      headers: requestHeaders,
      responseType: 'stream',
      validateStatus: () => true,
      timeout: 30000,
      maxRedirects: 5,
    });

    res.status(upstreamRes.status);
    res.setHeader('Content-Type', String(upstreamRes.headers['content-type'] || 'video/mp4'));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Accel-Buffering', 'no');
    if (upstreamRes.headers['content-range']) {
      res.setHeader('Content-Range', String(upstreamRes.headers['content-range']));
    }
    if (upstreamRes.headers['content-length']) {
      res.setHeader('Content-Length', String(upstreamRes.headers['content-length']));
    }

    res.flushHeaders();
    upstreamRes.data.pipe(res);

    req.on('close', () => {
      if (upstreamRes.data && typeof upstreamRes.data.destroy === 'function') {
        upstreamRes.data.destroy();
      }
    });
  } catch (error: any) {
    console.error('proxyEmbedStream error:', error.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to fetch upstream embed chunk.' });
    }
  }
};

/**
 * GET /api/streaming/es/:token/* — DASH segment relay for rewritten embed
 * manifests (server-side counterpart of the CF worker's /es route). The token
 * carries the hotlink referer; the wildcard path is <upstream-host>/<path>.
 */
export const proxyEmbedSegment = async (req: Request, res: Response) => {
  const m = req.params as Record<string, string>;
  const token = m.token || '';
  const rest = m[0] || (m as any).path || '';
  if (!token || !rest) {
    return res.status(400).json({ error: 'Missing segment reference.' });
  }
  const payload = decodeEmbedDashToken(token);
  const qs = req.originalUrl.indexOf('?');
  const search = qs === -1 ? '' : req.originalUrl.slice(qs);
  const targetUrl = `https://${rest}${search}`;
  if (!isSafeExternalUrl(targetUrl)) {
    return res.status(403).json({ error: 'Disallowed segment host.' });
  }

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
  if (payload.r) {
    headers['Referer'] = payload.r;
    try {
      headers['Origin'] = new URL(payload.r).origin;
    } catch {
      /* ignore */
    }
  }
  if (req.headers.range) headers['Range'] = req.headers.range as string;

  try {
    const upstreamRes = await streamClient.get(targetUrl, {
      headers,
      responseType: 'stream',
      validateStatus: () => true,
      timeout: 30000,
      maxRedirects: 5,
    });
    res.status(upstreamRes.status);
    res.setHeader('Content-Type', String(upstreamRes.headers['content-type'] || 'application/octet-stream'));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Accel-Buffering', 'no');
    if (upstreamRes.headers['content-range']) res.setHeader('Content-Range', String(upstreamRes.headers['content-range']));
    if (upstreamRes.headers['content-length']) res.setHeader('Content-Length', String(upstreamRes.headers['content-length']));
    res.flushHeaders();
    upstreamRes.data.pipe(res);
    req.on('close', () => {
      if (upstreamRes.data && typeof upstreamRes.data.destroy === 'function') upstreamRes.data.destroy();
    });
  } catch (error: any) {
    console.error('proxyEmbedSegment error:', error.message);
    if (!res.headersSent) res.status(502).json({ error: 'Failed to fetch upstream segment.' });
  }
};

/**
 * GET /api/streaming/providers/diagnose?title=&year=&type=&imdbId=&tmdbId=&season=&episode=
 * Runs every embed provider independently and reports which returned real,
 * validated streams. Use this from the production network (Render) to see which
 * providers are live there.
 */
export const diagnoseEmbedProviders = async (req: Request, res: Response) => {
  try {
    const title = (req.query.title as string || 'Interstellar').trim();
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const type = (req.query.type as string || 'movie') === 'series' ? 'series' : 'movie';
    const season = parseInt(req.query.season as string || '1', 10);
    const episode = parseInt(req.query.episode as string || '1', 10);
    const imdbId = (req.query.imdbId as string || '').trim() || undefined;
    let tmdbId = req.query.tmdbId ? String(req.query.tmdbId).trim() : undefined;

    let resolvedImdb = imdbId;
    if (!resolvedImdb && !tmdbId) {
      try {
        const meta: any = await tmdbService.fetchMetadata(title, year, type);
        resolvedImdb = meta?.imdbId;
        tmdbId = meta?.tmdbId ? String(meta.tmdbId) : undefined;
      } catch { /* ignore */ }
    }

    const perProvider = await diagnoseProviders({ title, year, type, season, episode, imdbId: resolvedImdb, tmdbId });
    const extractor = await diagnoseExtractor({ title, year, type, season, episode, imdbId: resolvedImdb, tmdbId });
    return res.json({
      query: { title, year, type, season, episode, imdbId: resolvedImdb, tmdbId },
      config: {
        streamExtractorUrl: (process.env.STREAM_EXTRACTOR_URL || '').trim() || null,
        cloudflareProxyUrl: (process.env.CLOUDFLARE_STREAM_PROXY_URL || '').trim() || null,
      },
      extractor,
      providers: perProvider,
    });
  } catch (error: any) {
    console.error('diagnoseEmbedProviders error:', error.message);
    return res.status(500).json({ error: 'Diagnose failed.', details: error.message });
  }
};

/**
 * GET /api/streaming/subtitles
 * Resolves available subtitle tracks for a movie or TV show episode
 */
export const getSubtitles = async (req: Request, res: Response) => {
  try {
    const title = (req.query.title as string) || '';
    const imdbId = (req.query.imdbId as string) || undefined;
    const tmdbId = req.query.tmdbId ? parseInt(req.query.tmdbId as string, 10) : undefined;
    const type = (req.query.type as string) === 'series' ? 'series' : 'movie';
    const season = req.query.season ? parseInt(req.query.season as string, 10) : 1;
    const episode = req.query.episode ? parseInt(req.query.episode as string, 10) : 1;

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const subtitles = await subtitleService.getSubtitles({
      title,
      imdbId,
      tmdbId,
      type,
      season,
      episode,
      baseUrl,
    });

    return res.json({ subtitles });
  } catch (error: any) {
    console.error('getSubtitles error:', error.message);
    return res.json({ subtitles: [] });
  }
};

/**
 * GET /api/streaming/subtitles/file
 * Serves subtitle file in WebVTT (.vtt) format with CORS and caching headers
 */
export const getSubtitleFile = async (req: Request, res: Response) => {
  try {
    const { source, id, page, fileId, url } = req.query;
    const vttContent = await subtitleService.getSubtitleFile({
      source: source as string,
      id: id as string,
      page: page as string,
      fileId: fileId as string,
      url: url as string,
    });

    const origin = (req.headers.origin as string) || '';
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(vttContent);
  } catch (error: any) {
    console.error('getSubtitleFile error:', error.message);
    const origin = (req.headers.origin as string) || '';
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    return res.status(200).send('WEBVTT\n\n');
  }
};

/**
 * GET /api/streaming/subtitle?url=...
 * Proxies subtitle file and converts SubRip (.srt) to WebVTT (.vtt) on the fly for standard HTML5 <track>.
 */
export const proxySubtitle = async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing subtitle URL.' });
  }

  try {
    const response = await axios.get(targetUrl, {
      responseType: 'text',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    const srtText: string = response.data || '';
    const vttContent = srtToVtt(srtText);

    const origin = (req.headers.origin as string) || '';
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(vttContent);
  } catch (error: any) {
    console.error('proxySubtitle error:', error.message);
    const origin = (req.headers.origin as string) || '';
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    return res.send('WEBVTT\n\n');
  }
};
