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
const WAIT_FOR_MEDIA = parseInt(process.env.WAIT_FOR_MEDIA || '20000', 10);
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || String(20 * 60 * 1000), 10);

// NOTE: no User-Agent override anywhere in this service. Embed providers
// (vidlink.pro at least) detect stale/spoofed UAs and silently never start
// the player; the real Chromium UA works. The relay worker injects its own
// browser UA when fetching the CDN, which the CDN accepts.
const UA = null;

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

  // vidlink.pro — browser passes CF, then its player fetches the real DASH/HLS.
  // Series path is /tv/{tmdb}/{s}/{e} (old /tv-series/ now 404s).
  if (tmdbId) {
    targets.push({
      provider: 'vidlink',
      page:
        type === 'movie'
          ? `https://vidlink.pro/movie/${tmdbId}`
          : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
      referer: 'https://vidlink.pro/',
    });
  }

  // vidsrc family — vidsrc.xyz DNS is dead; use live successors.
  targets.push({
    provider: 'vidsrc',
    page:
      type === 'movie'
        ? `https://vidsrc.ink/embed/movie/${id}`
        : `https://vidsrc.ink/embed/tv/${id}/${season}/${episode}`,
    referer: 'https://vidsrc.ink/',
  });
  targets.push({
    provider: 'vidfast',
    page:
      type === 'movie'
        ? `https://vidfast.pro/movie/${id}`
        : `https://vidfast.pro/tv/${id}/${season}/${episode}`,
    referer: 'https://vidfast.pro/',
  });

  // 2embed (www.2embed.cc now 301s to 2embed.skin — go direct)
  if (imdbId) {
    targets.push({
      provider: '2embed',
      page:
        type === 'movie'
          ? `https://2embed.skin/embed/${imdbId}`
          : `https://2embed.skin/embedtv/${imdbId}&s=${season}&e=${episode}`,
      referer: 'https://2embed.skin/',
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
          // Container-only memory trims: --single-process/--no-zygote are
          // Linux-specific and break Chromium startup on Windows/macOS.
          ...(process.platform === 'linux'
            ? ['--single-process', '--no-zygote']
            : []),
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--mute-audio',
          '--autoplay-policy=no-user-gesture-required',
          '--window-size=1280,720',
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
  const diag = { provider: target.provider, page: target.page };
  const t0 = Date.now();

  let browser;
  try {
    browser = await getBrowser();
  } catch (e) {
    diag.browserError = (e && e.message) || String(e);
    diag.ms = Date.now() - t0;
    return { ok: false, diag };
  }

  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  } catch (e) {
    diag.newPageError = (e && e.message) || String(e);
    diag.ms = Date.now() - t0;
    return { ok: false, diag };
  }

  // Only URLs whose RESPONSE actually returned <400 count as playable.
  // Embed pages fire decoy media requests (e.g. a hotlinked mp4 that 403s
  // everywhere) before the player's real .mpd/.m3u8 lands — a request-only
  // match grabs the decoy and the stream dies in our relay.
  const candidates = new Map(); // url -> status
  const consider = (res) => {
    const u = res.url();
    if (MEDIA_RE.test(u) && !AD_RE.test(u) && res.status() < 400) {
      if (!candidates.has(u)) candidates.set(u, res.status());
    }
  };
  page.on('response', consider);

  let mainStatus = null;

  // Rank: DASH/HLS manifests are the real adaptive streams; mp4 last.
  const bestOf = (map) => {
    let best = null;
    for (const u of map.keys()) {
      const score = /\.mpd(\?|$)/i.test(u) ? 3 : /\.m3u8(\?|$)/i.test(u) ? 2 : 1;
      if (!best || score > best.score) best = { u, score };
    }
    return best && best.u;
  };

  try {
    const resp = await page.goto(target.page, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    if (resp) {
      mainStatus = resp.status();
      diag.finalUrl = resp.url();
    }
    // Give the player time to resolve CF + fetch the manifest/file.
    // Exit early once a real manifest (.mpd/.m3u8) has been served with 200.
    // Many embed players stay idle until a gesture, so nudge once after ~6s.
    const start = Date.now();
    let nudged = false;
    while (Date.now() - start < WAIT_FOR_MEDIA) {
      const cur = bestOf(candidates);
      if (cur && !/\.mp4(\?|$)/i.test(cur)) break; // manifest found — stop waiting
      if (!nudged && Date.now() - start > 6000) {
        nudged = true;
        await page.evaluate(() => {
          const v = document.querySelector('video');
          if (v) { v.click(); v.play && v.play().catch(() => {}); }
          const b = document.querySelector('[class*="play"]');
          if (b) b.click();
        }).catch(() => {});
        diag.nudged = true;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (e) {
    // navigation errors are common with these providers; keep whatever we captured
    diag.navError = (e && e.message) || String(e);
  } finally {
    await page.close().catch(() => {});
  }

  const captured = bestOf(candidates);
  diag.ms = Date.now() - t0;
  diag.mainStatus = mainStatus;
  diag.captured = captured;
  if (!captured) return { ok: false, diag };
  return {
    ok: true,
    diag,
    result: { url: captured, referer: target.referer, provider: target.provider, kind: classifyKind(captured) },
  };
}

async function extract(ctx) {
  const targets = buildEmbedTargets(ctx);
  // Embed pages are flaky (CDN challenges resolve only on some attempts), so
  // give the highest-priority provider a second pass at the end.
  if (targets.length > 0) targets.push({ ...targets[0], retry: true });
  const diags = [];
  for (const t of targets) {
    const out = await extractFromTarget(t);
    diags.push(out.diag);
    if (out.ok) return { result: out.result, diags };
  }
  return { result: null, diags };
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

    const { result, diags } = await extract(ctx);
    if (!result) return res.status(404).json({ error: 'No playable stream found from any provider.', debug: diags });

    cacheSet(key, result);
    return res.json({ ...result, debug: diags });
  } catch (err) {
    console.error('extract error:', err && err.message);
    return res.status(500).json({ error: 'Extraction failed.', details: err && err.message });
  }
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'stream-extractor-worker' }));

// Browser self-test: proves whether Chromium can actually launch on this host.
app.get('/browser-test', async (_req, res) => {
  const t0 = Date.now();
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent('<h1 id="x">chromium-ok</h1>');
    const text = await page.evaluate(() => document.getElementById('x').innerText);
    await page.close();
    return res.json({ ok: true, chromePath: CHROME_PATH, ms: Date.now() - t0, sample: text });
  } catch (e) {
    return res.status(500).json({ ok: false, chromePath: CHROME_PATH, ms: Date.now() - t0, error: (e && e.message) || String(e) });
  }
});

app.get('/extract', (req, res) => handleExtract(readCtx(req.query), res));
app.post('/extract', (req, res) => handleExtract(readCtx(req.body || {}), res));

app.listen(PORT, () => {
  console.log(`stream-extractor-worker listening on :${PORT} (chrome=${CHROME_PATH})`);
});
