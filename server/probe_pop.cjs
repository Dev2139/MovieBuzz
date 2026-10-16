require('dotenv').config();
const key = process.env.TMDB_API_KEY;
(async () => {
  for (const id of [1573, 157336, 27205, 781732]) {
    const r = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${key}`).then((x) => x.json()).catch(() => null);
    if (!r || !r.title) { console.log(id, 'NOT FOUND'); continue; }
    console.log(id, JSON.stringify({ title: r.title, date: r.release_date, popularity: r.popularity, vote: r.vote_count }));
  }
})();
