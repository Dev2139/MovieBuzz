/**
 * Embed Provider Resolver
 * -----------------------------------------------------------------------------
 * On-demand, zero-storage stream resolver. Given a title + identifiers it asks
 * several free "embed" sources for a directly playable media URL (MP4 / HLS /
 * DASH), validates each candidate (rejecting the tiny placeholder / deprecation
 * notice videos that some upstreams return), and hands back only real streams.
 *
 * Nothing is stored in the DB and no bytes pass through our disk — the returned
 * URL is later proxied on the fly by the streaming controller (your own player
 * keeps full control of playback, quality, subtitles, resume, etc).
 *
 * The provider list is intentionally data-driven so new/working sources can be
 * added without touching the rest of the codebase.
 */

import axios from 'axios';

export interface EmbedResolveContext {
  title: string;
  year?: number;
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
  imdbId?: string;
  tmdbId?: number | string;
}

export interface RawEmbedSource {
  url: string;        // directly playable URL (mp4 / .m3u8 / .mpd)
  referer?: string;   // hotlink referer required by the CDN
  origin?: string;
  provider: string;
}

export type StreamKind = 'mp4' | 'hls' | 'dash';

export interface ValidatedEmbedSource extends RawEmbedSource {
  kind: StreamKind;
  sizeBytes?: number; // known for mp4 (used to reject placeholders)
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// A genuine feature film at any bitrate is far larger than this. Anything below
// is almost certainly the upstream "service discontinued" placeholder clip.
const MIN_REAL_MP4_BYTES = 5 * 1024 * 1024; // 5 MB
const REQUEST_TIMEOUT = 12000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function guessKind(url: string): StreamKind {
  // Several providers hand back an extensionless proxy URL whose REAL asset is
  // inside the query string (…/proxy?url=https://host/hls/<hash>). Look there
  // first, otherwise a genuine HLS stream would be treated as a plain mp4 and
  // the player would never parse the playlist.
  let inner = url;
  try {
    const u = new URL(url);
    for (const key of ['url', 'src', 'file', 'u']) {
      const v = u.searchParams.get(key);
      if (v && /^https?:\/\//i.test(v)) { inner = v; break; }
    }
  } catch { /* relative/odd url: use it as-is */ }
  const clean = inner.split('?')[0].toLowerCase();
  if (clean.endsWith('.m3u8') || /\/hls\//.test(clean)) return 'hls';
  if (clean.endsWith('.mpd')) return 'dash';
  return 'mp4';
}

function b64(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64');
}

/** Extract absolute .m3u8 / .mp4 / .mpd URLs out of an arbitrary HTML/JS blob. */
function extractMediaUrls(text: string): string[] {
  const out = new Set<string>();
  const re =
    /https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4|mpd)(?:\?[^\s"'<>\\]*)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const u = m[0].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    out.add(u);
  }
  return Array.from(out);
}

/** Pull the first string value from a nested object for any of the given keys. */
function firstStringField(obj: any, keys: string[]): string | undefined {
  if (!obj) return undefined;
  if (typeof obj === 'string') {
    return /\.(m3u8|mp4|mpd)(\?|$)/i.test(obj) ? obj : undefined;
  }
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }
  // common nested shapes
  if (Array.isArray(obj?.sources)) {
    for (const s of obj.sources) {
      const found = firstStringField(s, keys);
      if (found) return found;
    }
  }
  if (obj?.data) {
    const found = firstStringField(obj.data, keys);
    if (found) return found;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------
// NOTE: the old raw-HTTP providers (vidlink POST, vidsrc.xyz, 2embed, multiembed)
// were removed. Their pages either no longer resolve (dead domains) or expose
// only decoy/promo media — and an mp4 decoy that slipped past validation used
// to be RANKED FIRST (mp4 > dash), which is what played "a random video" for
// some titles. The headless extractor is the only provider proven to capture
// the real, correct stream (keyed by our own TMDB/IMDb ids).
type ProviderFn = (ctx: EmbedResolveContext) => Promise<RawEmbedSource[]>;

const PROVIDERS: Record<string, ProviderFn> = {
  // Headless extractor worker — the ONLY provider that can pass Cloudflare JS
  // challenges. Delegates to a separate Chromium service (STREAM_EXTRACTOR_URL)
  // which loads the gated embed page in a real browser and captures the actual
  // playable .m3u8/.mp4 request. Returns it so your own player streams it.
  'headless': async (ctx) => {
    const base = (process.env.STREAM_EXTRACTOR_URL || '').trim();
    if (!base) return [];
    const id = ctx.imdbId || ctx.tmdbId;
    if (!id) return [];
    const params = new URLSearchParams({
      type: ctx.type,
      season: String(ctx.season || 1),
      episode: String(ctx.episode || 1),
    });
    if (ctx.imdbId) params.set('imdbId', ctx.imdbId);
    if (ctx.tmdbId) params.set('tmdbId', String(ctx.tmdbId));
    const clean = base.replace(/\/+$/, '');

    // Embed sites are intermittently flaky per title (their CDN challenge only
    // resolves on some attempts) — the worker itself re-draws each provider.
    // The extractor already retries each provider/id-form internally, so a
    // definitive 404 ("no media anywhere") is honest and re-running it would
    // just double the wait. A retry only helps when the CALL itself failed
    // (worker restart, transient network/5xx), so that case is retried once.
    const fetchExtract = async (attempt = 1): Promise<RawEmbedSource[]> => {
      try {
        const res = await axios.get(`${clean}/extract?${params.toString()}`, {
          timeout: 90000,
          validateStatus: () => true,
        });
        const data = res.data;
        if (data && typeof data.url === 'string') {
          return [
            {
              url: data.url,
              referer: data.referer || `${base}`,
              provider: data.provider || 'headless',
            },
          ];
        }
        // If Render returned 502/503 during cold-start, wait 4s and retry once
        if ((res.status === 502 || res.status === 503) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 4000));
          return fetchExtract(attempt + 1);
        }
        if (res.status === 404) return [];
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 3000));
          return fetchExtract(attempt + 1);
        }
        return [];
      }
      return [];
    };

    return fetchExtract();
  },
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

async function validateSource(src: RawEmbedSource): Promise<ValidatedEmbedSource | null> {
  const kind = guessKind(src.url);
  const headers: Record<string, string> = { 'User-Agent': BROWSER_UA };
  if (src.referer) headers['Referer'] = src.referer;
  if (src.origin) headers['Origin'] = src.origin;

  try {
    if (kind === 'mp4') {
      // Ask for the first byte only — fast and gives us total size via content-range.
      const res = await axios.get(src.url, {
        headers: { ...headers, Range: 'bytes=0-1' },
        responseType: 'stream',
        timeout: REQUEST_TIMEOUT,
        validateStatus: () => true,
        maxRedirects: 5,
      });
      res.data.destroy?.();
      const contentType = String(res.headers['content-type'] || '');
      const cr = String(res.headers['content-range'] || '');
      const cl = parseInt(String(res.headers['content-length'] || '0'), 10);
      let size = NaN;
      const m = cr.match(/\/(\d+)\s*$/);
      if (m) size = parseInt(m[1], 10);
      else if (!Number.isNaN(cl)) size = cl;

      // Reject deprecation / placeholder clips (small mp4 served as text, etc.)
      if (Number.isFinite(size) && size < MIN_REAL_MP4_BYTES) return null;
      if (contentType.startsWith('text/')) return null;
      if (res.status !== 200 && res.status !== 206) return null;
      return { ...src, kind, sizeBytes: Number.isFinite(size) ? size : undefined };
    }

    // HLS / DASH: fetch manifest and sanity-check its body.
    const res = await axios.get(src.url, {
      headers,
      responseType: 'text',
      timeout: REQUEST_TIMEOUT,
      validateStatus: () => true,
      maxRedirects: 5,
    });
    const text = String(res.data || '');
    if (res.status !== 200) return null;
    if (kind === 'hls' && !text.includes('#EXTM3U')) return null;
    if (kind === 'dash' && !/<MPD|<Period|Representation/i.test(text)) return null;
    // Reject manifests pointing at a known tiny placeholder only (best effort).
    if (text.length < 40) return null;
    return { ...src, kind };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a set of real, validated, directly-playable sources for the given
 * content. Runs every provider concurrently, validates results, dedupes by URL,
 * and orders MP4 > HLS > DASH (MP4 integrates best with the byte-range player).
 */
export async function resolveEmbedSources(
  ctx: EmbedResolveContext
): Promise<ValidatedEmbedSource[]> {
  const providerNames = Object.keys(PROVIDERS);
  const nested = await Promise.all(
    providerNames.map(async (name) => {
      try {
        return await PROVIDERS[name](ctx);
      } catch {
        return [] as RawEmbedSource[];
      }
    })
  );

  const candidates = nested.flat();

  // Dedupe by normalized URL.
  const seen = new Set<string>();
  const unique: RawEmbedSource[] = [];
  for (const c of candidates) {
    const key = c.url.replace(/[\?#].*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  const validated = await Promise.all(unique.map(validateSource));
  const real = validated.filter((v): v is ValidatedEmbedSource => v !== null);

  const rank: Record<StreamKind, number> = { mp4: 0, hls: 1, dash: 2 };
  real.sort((a, b) => rank[a.kind] - rank[b.kind]);

  return real;
}

/**
 * Diagnostic runner: reports what EACH provider returned independently, so you
 * can see from the production network exactly which sources are live.
 */
export async function diagnoseProviders(
  ctx: EmbedResolveContext
): Promise<Record<string, { found: number; validated: number; candidates: string[]; real: string[] }>> {
  const out: Record<string, any> = {};
  await Promise.all(
    Object.keys(PROVIDERS).map(async (name) => {
      let cands: RawEmbedSource[] = [];
      try {
        cands = await PROVIDERS[name](ctx);
      } catch {
        cands = [];
      }
      const validated = await Promise.all(cands.map(validateSource));
      const real = validated.filter((v): v is ValidatedEmbedSource => v !== null);
      out[name] = {
        found: cands.length,
        validated: real.length,
        candidates: cands.map((c) => c.url),
        real: real.map((r) => r.url),
      };
    })
  );
  return out;
}

/**
 * Probe the headless extractor worker directly and report WHY it may be failing:
 * whether STREAM_EXTRACTOR_URL is configured, whether /health is reachable, and
 * the exact status + body returned by /extract. This turns the silent `headless:
 * found 0` into an actionable signal.
 */
export async function diagnoseExtractor(ctx: EmbedResolveContext): Promise<Record<string, any>> {
  const base = (process.env.STREAM_EXTRACTOR_URL || '').trim();
  const info: Record<string, any> = { configured: !!base, base: base || null };
  if (!base) return info;
  const clean = base.replace(/\/+$/, '');

  try {
    const h = await axios.get(`${clean}/health`, { timeout: 15000, validateStatus: () => true });
    info.healthStatus = h.status;
    info.healthBody = JSON.stringify(h.data ?? '').slice(0, 200);
  } catch (e: any) {
    info.healthError = (e && e.message) || String(e);
  }

  const id = ctx.imdbId || ctx.tmdbId;
  if (id) {
    const params = new URLSearchParams({
      type: ctx.type,
      season: String(ctx.season || 1),
      episode: String(ctx.episode || 1),
    });
    if (ctx.imdbId) params.set('imdbId', ctx.imdbId);
    if (ctx.tmdbId) params.set('tmdbId', String(ctx.tmdbId));
    try {
      const t0 = Date.now();
      const e = await axios.get(`${clean}/extract?${params.toString()}`, {
        timeout: 60000,
        validateStatus: () => true,
      });
      info.extractStatus = e.status;
      info.extractMs = Date.now() - t0;
      info.extractBody = JSON.stringify(e.data ?? '').slice(0, 400);
    } catch (e: any) {
      info.extractError = (e && e.message) || String(e);
    }
  }
  return info;
}
