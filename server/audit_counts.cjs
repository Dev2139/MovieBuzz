require('dotenv').config();
const m = require('mongoose');
(async () => {
  await m.connect(process.env.MONGODB_URI);
  const db = m.connection.db;
  const q = { $or: [{ tmdbId: { $exists: false } }, { tmdbId: null }, { tmdbId: '' }] };
  const names = await db.listCollections().toArray();
  const cols = names.map(x => x.name);
  console.log('collections:', cols.join(', '));
  for (const cn of cols.filter(n => /content|series|media/i.test(n))) {
    const c = db.collection(cn);
    const total = await c.countDocuments({});
    const noTmdb = await c.countDocuments(q);
    console.log(cn, '=> total:', total, 'noTmdbId:', noTmdb);
  }
  await m.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
