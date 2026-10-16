/**
 * End-to-end coverage + correctness audit against the RUNNING server.
 * For a sample of real DB titles: call /streaming/resolve exactly like the
 * client does, then read the returned manifest and compare its duration with
 * the true TMDB runtime — the strongest available proof that the video the
 * user clicked is the video that plays.
 */
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

const API = process.env.API_BASE || 'http://127.0.0.1:5000/api';
const KEY = process.env.TMDB_API_KEY;
const LIMIT = parseInt(process.env.LIMIT || '12', 10);

function dashDuration(text) {
  const m = text.match(/mediaPresentationDuration="PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?"/i);
  if (!m) return null;
  return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseFloat(m[3] || 0);
}
function hlsDuration(text) {
  if (!text.includes('#EXTM3U')) return null;
  if (/^#EXT-X-STREAM-INF/im.test(text)) {
    const v = text.match(/^\s*(https?:\/\/\S+|[^#\s].*)$/m);
    return v ? { nested: v[1].trim() } : null;
  }
  let total = 0, any = false;
  for (const line of text.split('\n')) {
    const m = line.match(/^#EXTINF:([\d.]+)/);
    if (m) { total += parseFloat(m[1]); any = true; }
  }
  return any ? total : null;
}

// The client-facing streamUrl is our relay; unwrap the original URL + referer.
function unwrap(streamUrl) {
  try {
    const u = new URL(streamUrl);
    return { url: u.searchParams.get('url'), referer: u.searchParams.get('r') || '' };
  } catch { return { url: null, referer: '' }; }
}

async function measure(raw, referer) {
  const headers = { Referer: referer || '', 'User-Agent': 'Mozilla/5.0' };
  const target = raw;
  const res = await axios.get(target, { headers, timeout: 30000, responseType: 'text', maxRedirects: 5 }).catch(() => null);
  if (!res) return null;
  const text = String(res.data || '');
  // The relay may hand back the manifest for either flavour; sniff the body.
  let d = /#EXTM3U/.test(text) ? hlsDuration(text) : dashDuration(text);
  if (d && d.nested) {
    const base = new URL(d.nested, target).toString();
    const sub = await axios.get(base, { headers, timeout: 30000, responseType: 'text' }).catch(() => null);
    d = sub ? hlsDuration(String(sub.data || '')) : null;
  }
  return typeof d === 'number' ? d : null;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('contents');
  // IDS="671,58,285" audits those specific DB tmdbIds; otherwise a DB sample.
  const wanted = (process.env.IDS || '').split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);
  const filter = wanted.length ? { tmdbId: { $in: wanted } } : { tmdbId: { $exists: true, $ne: null } };
  const items = await col.find(filter)
    .project({ title: 1, type: 1, tmdbId: 1, imdbId: 1, releaseYear: 1, runtime: 1 })
    .limit(wanted.length ? wanted.length : LIMIT).toArray();
  console.log(`auditing ${items.length} DB titles through ${API}/streaming/resolve\n`);

  const rows = [];
  for (const it of items) {
    const t0 = Date.now();
    const params = new URLSearchParams({ title: it.title, type: it.type === 'series' ? 'series' : 'movie', tmdbId: String(it.tmdbId) });
    if (it.imdbId) params.set('imdbId', it.imdbId);
    if (it.releaseYear) params.set('year', String(it.releaseYear));
    let outcome;
    try {
      const r = await axios.get(`${API}/streaming/resolve?${params}`, { timeout: 260000 });
      const sources = r.data.sources || [];
      if (!sources.length) {
        outcome = 'NO SOURCES';
      } else {
        const { url, referer } = unwrap(sources[0].streamUrl);
        const meta = await axios.get(`https://api.themoviedb.org/3/${it.type === 'series' ? 'tv' : 'movie'}/${it.tmdbId}?api_key=${KEY}`, { timeout: 15000 }).then((x) => x.data).catch(() => null);
        const expected = meta ? (it.type === 'series' ? (meta.episode_run_time || [])[0] : meta.runtime) : it.runtime;
        const got = url ? await measure(url, referer) : null;
        const mins = got ? got / 60 : null;
        outcome = mins == null
          ? `SOURCES=${sources.length} (${sources[0].quality}) duration UNKNOWN`
          : !expected
            ? `SOURCES=${sources.length} duration=${mins.toFixed(1)}min (no runtime to compare)`
            : (Math.abs(mins - expected) <= expected * 0.2
              ? `✓ MATCH ${mins.toFixed(1)}min vs TMDB ${expected}min (${sources[0].quality})`
              : `✗ MISMATCH ${mins.toFixed(1)}min vs TMDB ${expected}min (${sources[0].quality})`);
      }
    } catch (e) {
      outcome = 'ERROR ' + (e.message || e).slice(0, 80);
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`[${secs}s] ${it.title} (tmdb ${it.tmdbId}, ${it.type}) -> ${outcome}`);
    rows.push({ title: it.title, ok: outcome.startsWith('✓') || outcome.includes('no runtime'), outcome });
  }
  const match = rows.filter((r) => r.outcome.startsWith('✓')).length;
  const unknown = rows.filter((r) => r.outcome.includes('UNKNOWN') || r.outcome.includes('no runtime')).length;
  const none = rows.filter((r) => r.outcome === 'NO SOURCES').length;
  const bad = rows.filter((r) => r.outcome.startsWith('✗')).length;
  console.log(`\nSUMMARY  correct=${match}  no-source=${none}  wrong-content=${bad}  unverified=${unknown}  of ${rows.length}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
