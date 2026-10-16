require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('contents');
  const items = await col.find({ title: /interstellar|animal/i }, { projection: { title: 1, type: 1, year: 1, releaseYear: 1, tmdbId: 1, imdbId: 1, slug: 1 } }).toArray();
  for (const it of items) console.log(JSON.stringify(it));
  // What does TMDB say these ids are?
  const key = process.env.TMDB_API_KEY;
  for (const id of [...new Set(items.map((i) => i.tmdbId).filter(Boolean))]) {
    const r = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${key}`).then((x) => x.json()).catch(() => null);
    console.log('TMDB', id, '=>', r ? `"${r.title}" (${(r.release_date || '').slice(0, 10)})` : 'NOT FOUND');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
