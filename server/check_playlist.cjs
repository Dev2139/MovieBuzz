/**
 * Check whether a mov2day "master.m3u8" actually contains an ABR ladder, both
 * when fetched direct and when fetched through the Cloudflare relay. If the
 * relay's manifest rewrite drops the #EXT-X-STREAM-INF variant lines, the
 * player is stuck on one 1080p rendition and cannot back off on slow links.
 *
 *   node check_playlist.cjs "<master m3u8 url>" ["<referer>"]
 */
const axios = require('axios');

const rawArg = process.argv[2];
const referer = process.argv[3] || 'https://vidsrc.pm/';

async function freshUrl() {
  // No URL given: ask the deployed extractor (cached, so this is fast) for a
  // current mov2day master so the check never runs against an expired token.
  const r = await axios.get(
    'https://stream-extractor-0l96.onrender.com/extract?type=movie&imdbId=tt0816692&tmdbId=157336',
    { timeout: 200000 }
  );
  return r.data.url;
}

function describe(label, text) {
  const variants = (text.match(/#EXT-X-STREAM-INF/gi) || []).length;
  const segments = (text.match(/#EXTINF/gi) || []).length;
  const bandwidths = [...text.matchAll(/BANDWIDTH=(\d+)/gi)].map((m) => Math.round(+m[1] / 1000) + 'kbps');
  const resolutions = [...text.matchAll(/RESOLUTION=(\d+x\d+)/gi)].map((m) => m[1]);
  console.log(`${label}\n   variants=${variants} segments=${segments} bytes=${text.length}`);
  if (resolutions.length) console.log(`   resolutions: ${[...new Set(resolutions)].join(', ')}`);
  if (bandwidths.length) console.log(`   bandwidths : ${bandwidths.join(', ')}`);
  console.log(`   head: ${text.split('\n').slice(0, 6).join(' | ').slice(0, 300)}\n`);
}

(async () => {
  const raw = rawArg || (await freshUrl());
  console.log(`checking: ${String(raw).slice(0, 140)}\n`);
  const headers = { Referer: referer, 'User-Agent': 'Mozilla/5.0' };
  const direct = await axios.get(raw, { headers, timeout: 30000, responseType: 'text' }).catch((e) => ({ err: e.message }));
  if (direct.err) console.log(`DIRECT fetch failed: ${direct.err}\n`);
  else describe('--- DIRECT (as the extractor sees it) ---', String(direct.data));

  const relay = `https://cinestream-proxy.dev-patel-codinggita.workers.dev/embed?url=${encodeURIComponent(raw)}&r=${encodeURIComponent(referer)}`;
  const viaRelay = await axios.get(relay, { timeout: 30000, responseType: 'text' }).catch((e) => ({ err: e.message }));
  if (viaRelay.err) console.log(`RELAY fetch failed: ${viaRelay.err}\n`);
  else describe('--- THROUGH CLOUDFLARE RELAY (what the player sees) ---', String(viaRelay.data));
})();
