/**
 * Strict tmdbId audit & repair for contents:
 *  - records WITH tmdbId: verify TMDB's actual title matches the DB title.
 *    Mismatch  -> try exact search; update if exact, otherwise UNSET the bad id.
 *  - records WITHOUT tmdbId: set only when an exact (post-normalization) match
 *    is found. Never guess by popularity — wrong ids play wrong videos.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const DRY = process.env.DRY === '1';

const API_KEY = process.env.TMDB_API_KEY;
if (!API_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

const JUNK = /\b(1080p|720p|480p|4k|2160p|fhd|hd|sd|web[- ]?dl|webrip|bluray|bdrip|brrip|dvdrip|hdmovie|movie|dual[- ]audio|multi[- ]audio|hindi|tamil|telugu|malayalam|kannada|marathi|english|subtitles|sub|msub|esub|x264|x265|hevc|aac|s\d{1,2}e\d{1,2}|season\s*\d+|episode\s*\d+|ep\s*\d+|part\s*\d+|\d{4})\b/gi;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(JUNK, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tight(s) { return norm(s).replace(/ /g, ''); }

// Accept: exact normalized equality, punctuation-free equality ("Samdalri" vs
// "Samdal-ri"), or the TMDB title merely carrying a subtitle the DB omits
// ("John Wick Chapter 3" vs "John Wick Chapter 3 Parabellum").
function titlesMatch(dbNorm, dbTight, candTitle) {
  const cn = norm(candTitle);
  const ct = tight(candTitle);
  return cn === dbNorm || ct === dbTight || (dbTight.length >= 6 && ct.startsWith(dbTight));
}

async function tmdbGet(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

async function exactSearch(title, isTv, dbNorm, dbTight) {
  // ACCEPTANCE here is strict (normalized/punctuation-free EQUALITY only) —
  // prefix tolerance exists solely to VERIFY ids already in the DB, and using
  // it while SEARCHING produced wrong fixes ("The Court" -> "The Court
  // Jester"). Try the declared type first, then the other (DB type fields are
  // unreliable for imported rows: "The Night Agent" is stored as a movie).
  const tryEndpoint = async (endpoint) => {
    const data = await tmdbGet(`https://api.themoviedb.org/3/${endpoint}?api_key=${API_KEY}&query=${encodeURIComponent(title)}&include_adult=false`);
    const results = data?.results || [];
    return results.find((x) => { const n = norm(x.title || x.name), t = tight(x.title || x.name); return n === dbNorm || t === dbTight; }) || null;
  };
  const primary = await tryEndpoint(isTv ? 'search/tv' : 'search/movie');
  if (primary) return primary;
  return tryEndpoint(isTv ? 'search/movie' : 'search/tv');
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('contents');
  const items = await col.find({}, { projection: { title: 1, type: 1, tmdbId: 1 } }).toArray();
  console.log('scanning', items.length, 'records');

  let ok = 0, fixed = 0, unset = 0, skipped = 0;
  for (const it of items) {
    const dbNorm = norm(it.title);
    const dbTight = tight(it.title);
    if (!dbNorm) { skipped++; continue; }
    const isTv = it.type === 'series';
  
    if (it.tmdbId) {
      const info = await tmdbGet(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${it.tmdbId}?api_key=${API_KEY}`);
      const realTitle = info ? (info.title || info.name) : null;
      if (!realTitle) { skipped++; continue; } // lookup failed; leave as-is
      if (titlesMatch(dbNorm, dbTight, realTitle)) { ok++; continue; }
      console.log(`MISMATCH: "${it.title}" vs TMDB ${it.tmdbId}="${realTitle}"`);
      const match = await exactSearch(it.title, isTv, dbNorm, dbTight);
      if (match) {
        if (!DRY) await col.updateOne({ _id: it._id }, { $set: { tmdbId: match.id } });
        console.log(`   fixed -> ${match.id} (${match.title || match.name})`);
        fixed++;
      } else {
        if (!DRY) await col.updateOne({ _id: it._id }, { $unset: { tmdbId: '' } });
        console.log(`   unset bad tmdbId (no exact match)`);
        unset++;
      }
    } else {
      const match = await exactSearch(it.title, isTv, dbNorm, dbTight);
      if (match) {
        if (!DRY) await col.updateOne({ _id: it._id }, { $set: { tmdbId: match.id } });
        console.log(`FILLED: "${it.title}" -> ${match.id}`);
        fixed++;
      } else {
        skipped++;
      }
    }
    await new Promise((r) => setTimeout(r, 110));
  }
  console.log(`${DRY ? 'DRY-RUN' : 'DONE'} ok=${ok} fixed/added=${fixed} unset=${unset} skipped(no exact match / lookup fail)=${skipped}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
