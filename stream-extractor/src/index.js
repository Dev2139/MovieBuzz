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

// Locate a Chromium-family browser. In Render/Docker the env var (or the
// /usr/bin/chromium default) is authoritative; on developer machines fall
// back to auto-detecting the locally installed Chrome/Edge so the service
// "just runs" without env setup.
function detectChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const fs = require('fs');
  const path = require('path');
  const candidates =
    process.platform === 'win32'
      ? [
          path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ]
        : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p; } catch (_) { /* ignore */ }
  }
  return process.platform === 'win32'
    ? path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')
    : '/usr/bin/chromium';
}
const CHROME_PATH = detectChromePath();
const NAV_TIMEOUT = parseInt(process.env.NAV_TIMEOUT || '20000', 10);
const WAIT_FOR_MEDIA = parseInt(process.env.WAIT_FOR_MEDIA || '13000', 10);
// Hard ceiling for one /extract call across ALL provider attempts. Without
// it a title missing everywhere walks 6 targets x (nav+wait) ≈ 4.5min, the
// caller's own timeout fires, and the caller retries the whole marathon.
const TOTAL_BUDGET_MS = parseInt(process.env.EXTRACT_BUDGET_MS || String(95 * 1000), 10);
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || String(20 * 60 * 1000), 10);

// NOTE: no User-Agent override anywhere in this service. Embed providers
// (vidlink.pro at least) detect stale/spoofed UAs and silently never start
// the player; the real Chromium UA works. The relay worker injects its own
// browser UA when fetching the CDN, which the CDN accepts.
const UA = null;

// A real media asset URL.
const MEDIA_RE = /\.(m3u8|mp4|mpd)(\?|$)/i;
// Extensionless media paths used by proxy players (…/hls/<hash>, …/dash/<id>).
const MEDIA_PATH_RE = /\/(hls|dash|manifest|playlist)(\/|\?|$)/i;
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
  const vidlinkLikePage = (base, id) =>
    type === 'movie' ? `${base}/movie/${id}` : `${base}/tv/${id}/${season}/${episode}`;

  const targets = [];

  // vidsrc.pm — live successor of the vidsrc family (vidsrc.ink DNS is dead).
  // Independent catalogue from vidlink/MovieBox and answers in seconds, so it
  // sits right after vidlink's primary id form: titles the sacdn pool lacks
  // (Interstellar is one) resolve here via its mov2day HLS proxy.
  const pmTarget = {
    provider: 'vidsrc.pm',
    page: vidlinkLikePage('https://vidsrc.pm/embed', imdbId || tmdbId),
    referer: 'https://vidsrc.pm/',
  };
  // Its catalogue is IMDb-keyed, so a row that only reached it by TMDB id
  // (Harry Potter 1) still needs the tt form tried.
  const pmTargetAlt =
    imdbId && tmdbId
      ? {
          provider: 'vidsrc.pm',
          page: vidlinkLikePage('https://vidsrc.pm/embed', tmdbId),
          referer: 'https://vidsrc.pm/',
        }
      : null;

  // vidlink.pro — browser passes CF, then its player fetches the real DASH/HLS.
  // The same /movie/{id} path accepts BOTH IMDb (tt..) and TMDB ids, and their
  // catalogue is keyed primarily by IMDb: some canonical TMDB entries (e.g.
  // Interstellar 157336) have no asset under the numeric id but do under the
  // tt id, so try the IMDb form first and keep the TMDB form as a fallback.
  const vidlinkPage = (id) =>
    type === 'movie'
      ? `https://vidlink.pro/movie/${id}`
      : `https://vidlink.pro/tv/${id}/${season}/${episode}`;
  if (imdbId) {
    targets.push({
      provider: 'vidlink',
      page: vidlinkPage(imdbId),
      referer: 'https://vidlink.pro/',
    });
  }
  // Quality-first for vidlink (1080p HEVC DASH), but its alternate-catalogue
  // peer is tried before vidlink's second id form so unavailable titles fail
  // fast instead of burning two more slow pages.
  targets.push(pmTarget);
  if (pmTargetAlt) targets.push(pmTargetAlt);
  if (tmdbId && tmdbId !== imdbId) {
    targets.push({
      provider: 'vidlink',
      page: vidlinkPage(tmdbId),
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

function classifyKind(url, contentType) {
  const ct = String(contentType || '').toLowerCase();
  // The server's own answer beats the URL shape: several providers serve HLS
  // through extensionless proxies (e.g. /proxy?url=https://host/hls/<hash>).
  if (ct.includes('mpegurl') || ct.includes('x-mpegurl')) return 'hls';
  if (ct.includes('dash+xml')) return 'dash';
  const inner = decodeInnerUrl(url);
  const clean = inner.split('?')[0].toLowerCase();
  if (clean.endsWith('.m3u8') || /\/hls\//.test(inner)) return 'hls';
  if (clean.endsWith('.mpd')) return 'dash';
  return 'mp4';
}

// Some providers wrap the real asset in a proxy URL's `url=` parameter; that
// inner value is what tells us the stream type.
function decodeInnerUrl(url) {
  try {
    const u = new URL(url);
    for (const key of ['url', 'src', 'file', 'u']) {
      const v = u.searchParams.get(key);
      if (v && /^https?:\/\//i.test(v)) return v;
    }
  } catch { /* not parseable; use the raw url */ }
  return url;
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
  const candidates = new Map(); // url -> { status, contentType }
  const consider = (res) => {
    const u = res.url();
    if (AD_RE.test(u) || res.status() >= 400) return;
    const ct = String(res.headers()['content-type'] || '').toLowerCase();
    const byUrl = MEDIA_RE.test(u) || MEDIA_PATH_RE.test(u);
    const byCt = /mpegurl|dash\+xml|video\//i.test(ct);
    if (byUrl || byCt) {
      if (!candidates.has(u)) candidates.set(u, { status: res.status(), contentType: ct });
    }
  };
  page.on('response', consider);

  let mainStatus = null;

  // Rank: DASH/HLS manifests are the real adaptive streams; mp4 last.
  const scoreOf = (u, info) => {
    const ct = (info && info.contentType) || '';
    if (/mpegurl/i.test(ct)) return 4;
    const inner = decodeInnerUrl(u);
    if (/\.mpd(\?|$)/i.test(inner)) return 3;
    if (/\.m3u8(\?|$)/i.test(inner) || /\/hls\//i.test(inner)) return 2;
    if (/dash\+xml/i.test(ct)) return 3;
    return 1;
  };
  const bestOf = (map) => {
    let best = null;
    for (const [u, info] of map.entries()) {
      const score = scoreOf(u, info);
      if (!best || score > best.score) best = { u, score, info };
    }
    return best;
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
      // score >= 2 means an adaptive manifest (DASH/HLS) landed — that's the
      // best answer this page will give, stop waiting.
      if (cur && cur.score >= 2) break;
      // Dead/geo-blocked hosts answer >=400 immediately and NEVER stream media
      // afterwards — don't burn the full wait window on them.
      if (mainStatus >= 400 && candidates.size === 0 && Date.now() - start > 2500) break;
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

  const best = bestOf(candidates);
  diag.ms = Date.now() - t0;
  diag.mainStatus = mainStatus;
  diag.captured = best && best.u;
  if (!best) return { ok: false, diag };
  return {
    ok: true,
    diag,
    result: {
      url: best.u,
      referer: target.referer,
      provider: target.provider,
      kind: classifyKind(best.u, best.info && best.info.contentType),
    },
  };
}

async function extract(ctx) {
  const targets = buildEmbedTargets(ctx);
  const diags = [];
  const budgetStart = Date.now();

  // Was this failure worth drawing again? A page that loaded fine (200) and
  // simply streamed nothing is a "not in this catalogue" answer — retrying it
  // burns 20s for the same result. Navigation/DNS/5xx/403 failures ARE worth a
  // second draw because those providers gate on transient CDN challenges.
  const retryWorthwhile = (diag) =>
    !!diag.navError || !!diag.browserError || !!diag.newPageError ||
    diag.mainStatus === null || diag.mainStatus >= 400;

  for (const t of targets) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() - budgetStart > TOTAL_BUDGET_MS) {
        diags.push({ provider: t.provider, skipped: 'budget-exceeded' });
        break;
      }
      const target = attempt === 0 ? t : { ...t, retry: true };
      const out = await extractFromTarget(target);
      diags.push(out.diag);
      if (out.ok) return { result: out.result, diags };
      if (attempt === 0 && !retryWorthwhile(out.diag)) break;
      // Dead hosts answer in <1s; don't pay that twice.
      if (attempt === 0 && out.diag.ms < 3000) break;
    }
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
