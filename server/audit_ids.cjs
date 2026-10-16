// Audit: do DB content records' tmdbIds actually point to the same title?
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const col = db.collection('contents');
  const items = await col
    .find({}, { projection: { title: 1, year: 1, type: 1, tmdbId: 1, imdbId: 1, slug: 1 } })
    .limit(200)
    .toArray();
  console.log('total sampled:', items.length);
  const noTmdb = items.filter((i) => !i.tmdbId);
  console.log('missing tmdbId:', noTmdb.length);
  for (const i of noTmdb.slice(0, 15)) console.log('  NO-TMDB:', i.title, '|', i.type, '|', i.slug);

  // Verify a sample that HAS tmdbId against TMDB
  const key = process.env.TMDB_API_KEY || process.env.TMDB_API_KEY_READ || process.env.VITE_TMDB_API_KEY;
  console.log('TMDB key present:', Boolean(key));
  if (key) {
    const withTmdb = items.filter((i) => i.tmdbId).slice(0, 25);
    for (const i of withTmdb) {
      const path = i.type === 'series' ? `tv/${i.tmdbId}` : `movie/${i.tmdbId}`;
      try {
        const r = await fetch(`https://api.themoviedb.org/3/${path}?api_key=${key}`).then((x) => x.json());
        const real = r.title || r.name;
        const ok = real && real.toLowerCase().trim() === (i.title || '').toLowerCase().trim();
        if (!ok) console.log(`  MISMATCH: DB="${i.title}" (${i.year}) vs TMDB ${i.tmdbId}="${real}"`);
      } catch (e) {
        console.log('  lookup error', i.tmdbId, e.message);
      }
    }
    console.log('checked', withTmdb.length, 'records');
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
