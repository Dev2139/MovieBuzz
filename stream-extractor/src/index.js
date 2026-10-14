/**
 * Stream Extractor Worker
 * -----------------------------------------------------------------------------
 * A tiny, standalone service that runs a real headless Chromium to load
 * JS/Cloudflare-gated embed providers (vidlink.pro, vidsrc.xyz, 2embed, ...)
 * and captures the ACTUAL playable media request (.m3u8 / .mp4 / .mpd) the
 * provider's player makes. Because a real browser executes the challenge + JS,
 * we get the raw stream URL that a plain HTTP client never could.
 *
 * Your main API calls:  GET /extract?type=movie&imdbId=tt..&tmdbId=..&season=&episode=
 * and receives:         { url, referer, provider, kind }
 *
 * That URL is then proxied to your own player (controls stay yours). Nothing is
 * stored — the URL is resolved on demand.
 *
 * Designed to fit a small (free-tier) container: one reused browser, one page
 * at a time, aggressive memory flags.
 */

'use strict';

const express = require('express');
const puppeteer = require('puppeteer-core');

const PORT = process.env.PORT || 8080;
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/chromium';
const NAV_TIMEOUT = parseInt(process.env.NAV_TIMEOUT || '25000', 10);
const WAIT_FOR_MEDIA = parseInt(process.env.WAIT_FOR_MEDIA || '14000', 10);
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || String(20 * 60 * 1000), 10);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// A real media asset URL.
const MEDIA_RE = /\.(m3u8|mp4|mpd)(\?|$)/i;
// Obvious ad / analytics / tracking noise to ignore.
const AD_RE =
  /(doubleclick|googlesyndication|adservice|adsterra|adscale|popads|exoclick|propeller|juicyads|bidgear|mgid|taboola|outbrain|facebook|connect\.facebook|analytics|hotjar|clarity|yandex|mc\.yandex|gtag|gtm|googletagmanager|sb\.adscale|\/ads?\?|\/advert|spotx|pubmatic|adnxs|criteo|amazon-adsystem|\/pixel|beacon|telemetry|w\.gif|1x1)/i;

// ---------------------------------------------------------------------------
// Providers: build the embed URL the browser will open. Add / edit freely.
// ---------------------------------------------------------------------------
function buildEmbedTargets(ctx) {
  const { type, imdbId, tmdbId, season = 1, episode = 1 } = ctx;
  const id = imdbId || tmdbId;
  if (!id) return [];
  const targets = [];

  // vidlink.pro — browser passes CF, then its jwplayer fetches the real file.
  if (tmdbId) {
    targets.push({
      provider: 'vidlink',
      page:
        type === 'movie'
          ? `https://vidlink.pro/movie/${tmdbId}`
          : `https://vidlink.pro/tv-series/${tmdbId}/${season}/${episode}`,
      referer: 'https://vidlink.pro/',
    });
  }

  // vidsrc.xyz
  targets.push({
    provider: 'vidsrc',
    page:
      type === 'movie'
        ? `https://vidsrc.xyz/embed/movie/${id}`
        : `https://vidsrc.xyz/embed/tv/${id}/${season}/${episode}`,
    referer: 'https://vidsrc.xyz/',
  });

  // 2embed
  if (imdbId) {
    targets.push({
      provider: '2embed',
      page:
        type === 'movie'
          ? `https://www.2embed.cc/embed/${imdbId}`
          : `https://www.2embed.cc/embedtv/${imdbId}&s=${season}&e=${episode}`,
      referer: 'https://www.2embed.cc/',
    });
  }

  // multiembed / superembed
  targets.push({
    provider: 'multiembed',
    page:
      type === 'movie'
        ? `https://multiembed.mov/?video_id=${id}&tmdb=1`
        : `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`,
    referer: 'https://multiembed.mov/',
  });

  return targets;
}

// ---------------------------------------------------------------------------
// Browser lifecycle (single reused instance)
// ---------------------------------------------------------------------------
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--mute-audio',
          '--autoplay-policy=no-user-gesture-required',
          '--js-flags=--max-old-space-size=256',
          `--user-agent=${UA}`,
        ],
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

function classifyKind(url) {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.m3u8')) return 'hls';
  if (clean.endsWith('.mpd')) return 'dash';
  return 'mp4';
}

// ---------------------------------------------------------------------------
// Tiny result cache so repeat plays don't launch the browser again.
// ---------------------------------------------------------------------------
const cache = new Map();
function cacheKey(ctx) {
  return [ctx.type, ctx.imdbId || '', ctx.tmdbId || '', ctx.season || 1, ctx.episode || 1].join(':');
}
function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v;
  if (hit) cache.delete(key);
  return null;
}
function cacheSet(key, val) {
  if (cache.size > 200) {
    // drop oldest
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(key, { t: Date.now(), v: val });
}

// ---------------------------------------------------------------------------
// Core: open one embed page and capture the first real media request.
// ---------------------------------------------------------------------------
async function extractFromTarget(target) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(UA);

  let captured = null;
  const consider = (u) => {
    if (!captured && MEDIA_RE.test(u) && !AD_RE.test(u)) captured = u;
  };
  page.on('response', (res) => consider(res.url()));
  page.on('request', (req) => consider(req.url()));

  try {
    await page.goto(target.page, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    // Give the player time to resolve CF + fetch the manifest/file.
    const start = Date.now();
    while (!captured && Date.now() - start < WAIT_FOR_MEDIA) {
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (e) {
    // navigation errors are common with these providers; keep whatever we captured
  } finally {
    await page.close().catch(() => {});
  }

  if (!captured) return null;
  return { url: captured, referer: target.referer, provider: target.provider, kind: classifyKind(captured) };
}

async function extract(ctx) {
  const targets = buildEmbedTargets(ctx);
  for (const t of targets) {
    try {
      const result = await extractFromTarget(t);
      if (result && result.url) return result;
    } catch (e) {
      // try next provider
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

function readCtx(source) {
  return {
    type: source.type === 'series' ? 'series' : 'movie',
    imdbId: (source.imdbId || '').trim() || undefined,
    tmdbId: (source.tmdbId || '').trim() || undefined,
    season: parseInt(source.season || '1', 10),
    episode: parseInt(source.episode || '1', 10),
  };
}

async function handleExtract(ctx, res) {
  try {
    if (!ctx.imdbId && !ctx.tmdbId) {
      return res.status(400).json({ error: 'imdbId or tmdbId is required.' });
    }
    const key = cacheKey(ctx);
    const cached = cacheGet(key);
    if (cached) return res.json({ ...cached, cached: true });

    const result = await extract(ctx);
    if (!result) return res.status(404).json({ error: 'No playable stream found from any provider.' });

    cacheSet(key, result);
    return res.json(result);
  } catch (err) {
    console.error('extract error:', err && err.message);
    return res.status(500).json({ error: 'Extraction failed.', details: err && err.message });
  }
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'stream-extractor-worker' }));
app.get('/extract', (req, res) => handleExtract(readCtx(req.query), res));
app.post('/extract', (req, res) => handleExtract(readCtx(req.body || {}), res));

app.listen(PORT, () => {
  console.log(`stream-extractor-worker listening on :${PORT} (chrome=${CHROME_PATH})`);
});
