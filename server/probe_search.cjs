require('dotenv').config();
const key = process.env.TMDB_API_KEY;
(async () => {
  for (const q of ['Interstellar', 'Animal']) {
    const d = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${q}&include_adult=false`).then((x) => x.json());
    console.log(`\n### search "${q}" — top 6 by TMDB default order:`);
    for (const r of (d.results || []).slice(0, 6)) {
      console.log(`  id=${r.id} pop=${r.popularity?.toFixed?.(1)} votes=${r.vote_count} "${r.title}" (${(r.release_date || '').slice(0, 10)})`);
    }
  }
  // And what does vidlink itself return for each candidate id? Its /movie/{id}
  // 404s or shows a title — fetch the embed page <title> server-side.
})();
