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
// vidlink's player needs ~14s after DOM before it requests the .mpd (measured:
// 22.9s total for The Dark Knight), so a 13s window silently loses its only
// source. 18s covers it with margin.
const WAIT_FOR_MEDIA = parseInt(process.env.WAIT_FOR_MEDIA || '18000', 10);
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
  // Independent catalogue from vidlink/MovieBox. What it serves is usually HLS
  // via the mov2day proxy (natively decodable), but sometimes a
  // …/resource/h265/<hash>.mp4, which scores lowest and only wins if nothing
  // better exists.
  const pmTarget = {
    provider: 'vidsrc.pm',
    page: vidlinkLikePage('https://vidsrc.pm/embed', imdbId || tmdbId),
    referer: 'https://vidsrc.pm/',
    hlsCapable: true,
  };
  // Its catalogue is IMDb-keyed, so a row that only reached it by TMDB id
  // (Harry Potter 1) still needs the tt form tried.
  const pmTargetAlt =
    imdbId && tmdbId
      ? {
          provider: 'vidsrc.pm',
          page: vidlinkLikePage('https://vidsrc.pm/embed', tmdbId),
          referer: 'https://vidsrc.pm/',
          hlsCapable: true,
        }
      : null;

  // vidlink.pro — browser passes CF, then its player fetches the real DASH/HLS.
  // The same /movie/{id} path accepts BOTH IMDb (tt..) and TMDB ids, and its
  // catalogue is keyed primarily by IMDb: some canonical TMDB entries have no
  // asset under the numeric id but do under the tt id. It goes first because it
  // is the most reliable and often the ONLY source (The Dark Knight); extract()
  // still prefers vidsrc.pm's HLS when both answer, since vidlink's usual asset
  // is HEVC DASH, which the player can only decode through the WASM transcoder.
  // Put vidsrc.pm targets FIRST because it yields immediate, clean HLS streams in <15 seconds
  targets.push(pmTarget);
  if (pmTargetAlt) targets.push(pmTargetAlt);

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
// Flags every container needs. Deliberately WITHOUT --single-process /
// --no-zygote: those are memory trims, but Debian Chromium crashes on startup
// with them in a Render container (process exits in ~1s, no reason printed),
// which took the whole service down. They survive only as a fallback config.
const BASE_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-background-networking',
  '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=1280,720',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-crash-reporter',
  '--disable-breakpad',
];

// Tried top-down until one actually launches; the winner is remembered so a
// restart doesn't re-probe, and the failures are kept for /health.
const LAUNCH_CANDIDATES = [
  { name: 'container-default', args: BASE_ARGS },
  {
    name: 'low-memory',
    args: [...BASE_ARGS, ...(process.platform === 'linux' ? ['--single-process', '--no-zygote'] : [])],
  },
  { name: 'minimal', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] },
];

let launchReport = { launchedWith: null, attempted: [] };
let browserPromise = null;
let cachedBrowser = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const attempted = [];
      for (const cand of LAUNCH_CANDIDATES) {
        try {
          const browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: 'new',
            args: cand.args,
          });
          // If the browser dies mid-life (OOM, crash), drop the cached instance
          // so the next request relaunches instead of reusing a dead handle.
          browser.once('disconnected', () => {
            if (browserPromise && cachedBrowser === browser) browserPromise = null;
          });
          cachedBrowser = browser;
          launchReport = { launchedWith: cand.name, attempted };
          return browser;
        } catch (e) {
          attempted.push({
            config: cand.name,
            error: (((e && e.message) || String(e)) + '').replace(/\s+/g, ' ').slice(0, 300),
          });
        }
      }
      launchReport = { launchedWith: null, attempted };
      throw new Error(
        `Chromium failed to launch with every configuration (chrome=${CHROME_PATH}): ` +
          attempted.map((a) => `[${a.config}] ${a.error}`).join(' | ')
      );
    })().catch((err) => {
      browserPromise = null;
      cachedBrowser = null;
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

// How useful this candidate is to the END PLAYER, which is the only thing that
// decides whether the user sees a smooth picture:
//   5 HLS            - natively decodable everywhere, our best answer
//   4 DASH (h264)    - natively decodable
//   2 DASH (HEVC)    - only playable through the client's WASM transcoder,
//                      which stalls and downshifts on real connections
//   1 anything else  - unrecognised shape; treat as last resort
const NATIVE_SCORE = 4;
function scoreOf(u, info) {
  const ct = (info && info.contentType) || '';
  const inner = decodeInnerUrl(u);
  const isHls = /mpegurl/i.test(ct) || /\.m3u8(\?|$)/i.test(inner) || /\/hls\//i.test(inner);
  const isDash = /dash\+xml/i.test(ct) || /\.mpd(\?|$)/i.test(inner);
  if (isHls) return 5;
  if (isDash) return /h265|hevc/i.test(u) ? 2 : 4;
  return 1;
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

  // Rank by what the browser can actually decode without a transcoder.
  // (scoreOf lives at module scope so extract() can compare ACROSS targets.)
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
      // Any adaptive manifest (score >= 2) is a real answer from this page.
      // Waiting longer for a "better" one was tried and cost coverage: on
      // vidlink-only titles the sole asset IS HEVC DASH (score 2), so holding
      // out for score >= 4 just burned the per-call budget and returned nothing.
      // Preference between co-captured candidates is handled by scoreOf.
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
  diag.score = best ? best.score : 0;
  if (!best) return { ok: false, diag };
  return {
    ok: true,
    diag,
    result: {
      url: best.u,
      referer: target.referer,
      provider: target.provider,
      kind: classifyKind(best.u, best.info && best.info.contentType),
      // Not part of the API contract; lets extract() decide whether to keep
      // looking at further providers for something the player can decode
      // natively. Stripped before the response is sent.
      score: best.score,
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

  // Returning the FIRST provider that answered was wrong: vidsrc.pm can hand
  // back an unrecognised mp4-shaped asset while vidlink has a playable DASH
  // manifest for the same title, and vice versa. So collect the best candidate
  // across providers and stop early only once something the player can decode
  // natively (score >= NATIVE_SCORE) is in hand.
  // One page costs at most NAV_TIMEOUT + WAIT_FOR_MEDIA, so starting one with
  // barely any budget left lets the call overrun the caller's own timeout and
  // lose an answer we already have.
  const NEXT_PAGE_COST_MS = NAV_TIMEOUT + WAIT_FOR_MEDIA + 5000;

  let best = null;
  let pagesUsed = 0;
  for (const t of targets) {
    // Once a playable-but-transcoded answer (HEVC DASH) is in hand, keep
    // looking ONLY at providers that can serve native HLS — chasing a dead
    // vidfast/multiembed page can't improve the answer, and doing so pushed a
    // real title to 111s, past the caller's 115s timeout.
    if (best && !t.hlsCapable) {
      diags.push({ provider: t.provider, skipped: 'have-playable-answer' });
      continue;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const elapsed = Date.now() - budgetStart;
      // Always allow the first page; after that require a full page of budget.
      if (pagesUsed > 0 && elapsed + NEXT_PAGE_COST_MS > TOTAL_BUDGET_MS) {
        diags.push({ provider: t.provider, skipped: 'budget-exceeded' });
        break;
      }
      const target = attempt === 0 ? t : { ...t, retry: true };
      pagesUsed++;
      const out = await extractFromTarget(target);
      diags.push(out.diag);
      if (out.ok) {
        if (!best || out.result.score > best.score) best = out.result;
        break; // this page gave its answer; a second visit won't change it
      }
      if (attempt === 0 && !retryWorthwhile(out.diag)) break;
      // Dead hosts answer in <1s; don't pay that twice.
      if (attempt === 0 && out.diag.ms < 3000) break;
    }
    if (best && best.score >= NATIVE_SCORE) break;
  }
  return { result: best, diags };
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

    // `score` is internal ranking metadata, not part of the response contract.
    const publicResult = { url: result.url, referer: result.referer, provider: result.provider, kind: result.kind };
    cacheSet(key, publicResult);
    return res.json({ ...publicResult, debug: diags });
  } catch (err) {
    console.error('extract error:', err && err.message);
    return res.status(500).json({ error: 'Extraction failed.', details: err && err.message });
  }
}

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'stream-extractor-worker',
    chromePath: CHROME_PATH,
    browser: launchReport,
  })
);

// Browser self-test: proves whether Chromium can actually launch on this host.
app.get('/browser-test', async (_req, res) => {
  const t0 = Date.now();
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent('<h1 id="x">chromium-ok</h1>');
    const text = await page.evaluate(() => document.getElementById('x').innerText);
    await page.close();
    return res.json({ ok: true, chromePath: CHROME_PATH, ms: Date.now() - t0, sample: text, browser: launchReport });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, chromePath: CHROME_PATH, ms: Date.now() - t0, error: (e && e.message) || String(e), browser: launchReport });
  }
});

app.get('/extract', (req, res) => handleExtract(readCtx(req.query), res));
app.post('/extract', (req, res) => handleExtract(readCtx(req.body || {}), res));

app.listen(PORT, () => {
  console.log(`stream-extractor-worker listening on :${PORT} (chrome=${CHROME_PATH})`);
});
