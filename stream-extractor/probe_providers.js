// Probe many candidate embed providers for one title and report which serve real
// media. Usage: node probe_providers.js <imdbId> <tmdbId> [type]
const puppeteer = require('puppeteer-core');

const imdb = process.argv[2] || 'tt0816692';
const tmdb = process.argv[3] || '157336';
const type = process.argv[4] || 'movie';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Candidate embed hosts. Paths follow each provider's documented convention.
const CANDIDATES = [
  ['vidlink', `https://vidlink.pro/${type === 'movie' ? 'movie' : 'tv'}/${imdb}`],
  ['vidlink-src', `https://vidlink.src.rv.de/movie/${tmdb}`],
  ['vidlink.sx', `https://vidlink.sx/movie/${tmdb}`],
  ['vidsrc.cc', `https://vidsrc.cc/v2/embed/${type === 'movie' ? 'movie' : 'tv'}/${tmdb}${type === 'movie' ? '' : '?season=1&episode=1'}`],
  ['vidsrc.icu', `https://vidsrc.icu/embed/${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
  ['vidsrc.wtf', `https://vidsrc.wtf/embed/${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
  ['vidsrc.xyz', `https://vidsrc.xyz/embed/${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
  ['vidsrc.bz', `https://vidsrc.bz/embed/${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
  ['vidsrc.pm', `https://vidsrc.pm/embed/${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
  ['vidorax', `https://vidorax.ru/embed/${type === 'movie' ? 'movie' : 'tv'}?tmdb=${tmdb}`],
  ['vidfinity', `https://vidfinity.net/embed/${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
  ['2embed', `https://www.2embed.cc/embed${type === 'movie' ? '' : 'tv'}/${imdb}`],
  ['multiembed', `https://multiembed.mov/?video_id=${imdb}&tmdb=1`],
  ['superembed', `https://superembed.stream/embed/${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
  ['autoembed', `https://autoembed.co/${type === 'movie' ? 'movie' : 'tv'}/tmdb/${tmdb}`],
  ['embeds.click', `https://w13.verystox.com/embed19.php?host=videvalve&id=x`],
  ['vflox', `https://www.vflox.in/embed-2/${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
  ['server-mix', `https://mizax.club/embed-${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
  ['cloudvideo', `https://cloudvideo.tv/e/${imdb}`],
  ['vidplay', `https://vidplay.online/e/${imdb}`],
  ['upcloud', `https://upcloud.film/embed/${imdb}`],
  ['filemoon', `https://filemoon.sx/e/${imdb}`],
  ['swastika', `https://swastika.mx/embed/${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
  ['gamov', `https://gamov.de/embed-${type === 'movie' ? 'movie' : 'tv'}/${tmdb}`],
];

const MEDIA_RE = /\.(mpd|m3u8|mp4)(\?|$)/i;
const AD_RE = /(doubleclick|googlesyndication|adservice|adsterra|exoclick|propeller|juicyads|bidgear|mgid|taboola|outbrain|facebook|analytics|hotjar|clarity|yandex|gtag|gtm|googletagmanager|\/ads?\?|\/advert|pixel|beacon)/i;

async function probe(name, url) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'],
  });
  const out = { name, url, status: null, media: [], navError: null };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.on('response', (res) => {
      const u = res.url();
      if (MEDIA_RE.test(u) && !AD_RE.test(u) && res.status() < 400) out.media.push(`${res.status()} ${u.slice(0, 160)}`);
    });
    try {
      const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      out.status = r ? r.status() : 'no-resp';
      out.finalUrl = r ? r.url().slice(0, 140) : null;
    } catch (e) {
      out.navError = (e.message || '').slice(0, 90);
    }
    // nudge the player and wait for manifest traffic
    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v) { v.click(); v.play && v.play().catch(() => {}); }
      const b = document.querySelector('[class*="play"]');
      if (b) b.click();
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 12000));
    await page.close();
  } finally {
    await browser.close();
  }
  return out;
}

(async () => {
  for (const [name, url] of CANDIDATES) {
    const t0 = Date.now();
    const o = await probe(name, url);
    const ms = ((Date.now() - t0) / 1000).toFixed(0);
    const verdict = o.media.length ? `MEDIA(${o.media.length})` : (o.navError ? `NAV-ERR ${o.navError}` : `NO-MEDIA http=${o.status}`);
    console.log(`\n[${name}] ${ms}s  ${verdict}`);
    console.log(`   page: ${url}`);
    if (o.finalUrl && o.finalUrl !== url) console.log(`   -> ${o.finalUrl}`);
    for (const m of o.media.slice(0, 4)) console.log(`   * ${m}`);
  }
})();
