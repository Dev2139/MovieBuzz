// Deep-dive: what does vidlink actually serve for a given id?
// Prints every network request that looks media-ish, all <video>/<iframe> tags
// and the page's inline scripts' obvious player-config hints.
const puppeteer = require('puppeteer-core');

const pageUrl = process.argv[2] || 'https://vidlink.pro/movie/tt0816692';
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const hits = [];
  page.on('request', (req) => {
    const u = req.url();
    if (/mpd|m3u8|mp4|video|stream|dash|hls|src=/i.test(u) && !/\.(png|jpe?g|gif|svg|css|woff)/i.test(u)) {
      hits.push('REQ  ' + u.slice(0, 220));
    }
  });
  page.on('response', async (res) => {
    const u = res.url();
    const ct = String(res.headers()['content-type'] || '');
    if (/dash|m3u8|mp4|video\//i.test(ct) || /\.(mpd|m3u8|mp4)(\?|$)/i.test(u)) {
      hits.push(`RESP ${res.status()} ct=${ct} ${u.slice(0, 200)}`);
    }
  });

  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch((e) => console.log('nav:', e.message));
  await new Promise((r) => setTimeout(r, 8000));

  const dom = await page.evaluate(() => {
    const vids = [...document.querySelectorAll('video')].map((v) => ({
      src: v.src || v.currentSrc || null,
      sources: [...v.querySelectorAll('source')].map((s) => s.src),
      poster: v.poster || null,
    }));
    const iframes = [...document.querySelectorAll('iframe')].map((f) => f.src);
    const scripts = [...document.querySelectorAll('script')].map((s) => s.textContent || '').join('\n');
    const mediaInJs = [...new Set((scripts.match(/https?:\/\/[^'"\\\s<>]+?\.(mpd|m3u8|mp4)[^'"\\\s<>]*/gi) || []))].slice(0, 20);
    const keys = (scripts.match(/"(file|src|sources|videoUrl|hls|dash)[^,\n]{0,140}/gi) || []).slice(0, 25);
    return { title: document.title, vids, iframes, mediaInJs, keys, bodyStart: document.body ? document.body.innerText.slice(0, 400) : '' };
  }).catch((e) => ({ err: e.message }));

  // nudge play, then wait a bit more and re-collect
  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) { v.click(); v.play && v.play().catch(() => {}); }
    const b = document.querySelector('[class*="play"]');
    if (b) b.click();
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 15000));

  console.log('URL:', pageUrl);
  console.log('DOM:', JSON.stringify(dom, null, 1).slice(0, 3000));
  console.log('MEDIA NETWORK:');
  for (const h of [...new Set(hits)].slice(0, 40)) console.log('  ', h);
  await browser.close();
})();
