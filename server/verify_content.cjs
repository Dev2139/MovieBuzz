// Content-correctness check: for a title, capture the stream the extractor
// finds, then read the DASH/HLS manifest duration and compare it against the
// actual TMDB runtime. A wrong video almost always shows a mismatched runtime.
require('dotenv').config();
const axios = require('axios');

const EXTRACTOR = (process.env.STREAM_EXTRACTOR_URL || 'http://127.0.0.1:8080').trim();
const KEY = process.env.TMDB_API_KEY;

const titles = [
  { name: 'Interstellar', tmdb: 157336, imdb: 'tt0816692', type: 'movie' },
  { name: 'Inception', tmdb: 27205, type: 'movie' },
  { name: 'The Dark Knight', tmdb: 155, type: 'movie' },
  { name: 'Animal', tmdb: 781732, type: 'movie' },
  { name: 'Stranger Things', tmdb: 66639, type: 'series' },
];

function dashDuration(text) {
  const m = text.match(/mediaPresentationDuration="PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?"/i);
  if (!m) return null;
  return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseFloat(m[3] || 0);
}
function hlsDuration(text) {
  if (!text.includes('#EXTM3U')) return null;
  let total = 0, matched = false;
  // master playlist -> follow first variant; media playlist -> sum segments
  const v = text.match(/https?:\/\/[^\s]+\.m3u8[^\s]*/);
  if (/^#EXT-X-STREAM-INF/im.test(text) && v) return { nested: v[0] };
  for (const line of text.split('\n')) {
    const m = line.match(/^#EXTINF:([\d.]+)/);
    if (m) { total += parseFloat(m[1]); matched = true; }
  }
  return matched ? total : null;
}

(async () => {
  for (const t of titles) {
    const meta = await axios.get(`https://api.themoviedb.org/3/${t.type === 'movie' ? 'movie' : 'tv'}/${t.tmdb}?api_key=${KEY}`, { timeout: 15000 }).then((r) => r.data).catch(() => null);
    if (!meta) { console.log(`${t.name}: TMDB lookup failed`); continue; }
    const expectedMin = t.type === 'movie' ? meta.runtime : (meta.episode_run_time || [])[0];
    const imdb = meta.imdb_id;
    const q = new URLSearchParams({ type: t.type === 'series' ? 'series' : 'movie', tmdbId: String(t.tmdb) });
    if (imdb) q.set('imdbId', imdb);
    if (t.type === 'series') { q.set('season', '1'); q.set('episode', '1'); }
    const ex = await axios.get(`${EXTRACTOR}/extract?${q}`, { timeout: 130000, validateStatus: () => true }).catch((e) => ({ status: 0, data: { err: e.message } }));
    if (!ex.data || !ex.data.url) { console.log(`\n${t.name} (${expectedMin}min): extractor HTTP ${ex.status} -> no stream`); continue; }
    const url = ex.data.url;
    const headers = { Referer: ex.data.referer || 'https://vidlink.pro/', 'User-Agent': 'Mozilla/5.0' };
    let dur = null, note = '';
    if (/\.mpd/i.test(url)) {
      const mpd = await axios.get(url, { headers, timeout: 30000, responseType: 'text' }).then((r) => String(r.data)).catch((e) => null);
      if (mpd === null) { note = 'manifest fetch failed'; }
      else {
        dur = dashDuration(mpd);
        const reps = [...mpd.matchAll(/width="(\d+)"/g)].map((x) => +x[1]);
        note = `res=${Math.max(...reps, 0)}p codecsHint=${(mpd.match(/codecs="([^"]+)"/) || [])[1] || '?'}`;
      }
    } else if (/\.m3u8/i.test(url)) {
      const pl = await axios.get(url, { headers, timeout: 30000, responseType: 'text' }).then((r) => String(r.data)).catch(() => null);
      if (pl) {
        let d = hlsDuration(pl);
        if (d && d.nested) { const sub = await axios.get(d.nested, { headers, timeout: 30000, responseType: 'text' }).then((r) => String(r.data)).catch(() => null); d = sub ? hlsDuration(sub) : null; }
        dur = typeof d === 'number' ? d : null;
      }
    } else {
      const h = await axios.head(url, { headers, timeout: 30000 }).catch(() => null);
      note = `mp4 size=${h ? h.headers['content-length'] : '?'} (no duration available)`;
    }
    const mins = dur ? (dur / 60).toFixed(1) : null;
    const delta = dur && expectedMin ? Math.abs(dur / 60 - expectedMin) : null;
    const verdict = dur == null ? 'UNKNOWN' : delta <= expectedMin * 0.2 ? 'MATCH' : 'SUSPECT (wrong content?)';
    console.log(`\n${t.name} [TMDB ${t.tmdb}, imdb ${imdb}]  expected=${expectedMin}min got=${mins ? mins + 'min' : '?'} => ${verdict}`);
    console.log(`   ${ex.data.provider} ${note}`);
    console.log(`   ${String(url).slice(0, 130)}`);
  }
})();
