/**
 * Ad-hoc extractor probe: hits a running stream-extractor for a list of titles
 * and reports which provider/shape won, so provider-ordering changes can be
 * checked for both quality (HLS over HEVC DASH) and coverage regressions.
 *
 *   node test_extract.cjs [base]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8094';

const TITLES = [
  { name: 'Spider-Man 3 (was HEVC, wants HLS)', imdb: 'tt0936501', tmdb: '559' },
  { name: 'The Dark Knight (vidlink-only)', imdb: 'tt0468569', tmdb: '155' },
  { name: 'Interstellar (vidsrc.pm-only)', imdb: 'tt0816692', tmdb: '157336' },
  { name: 'Pirates 2 (was vidlink DASH)', imdb: 'tt0383574', tmdb: '58' },
  { name: 'Absent title (must fail fast, not hang)', imdb: 'tt0000001', tmdb: '999999' },
];

function hostOf(u) {
  const m = /https?:\/\/([^/]+)/.exec(u || '');
  return m ? m[1] : '-';
}
function shapeOf(u) {
  const inner = /url=([^&]+)/.exec(u || '');
  const s = decodeURIComponent(inner ? inner[1] : u || '');
  if (/h265|hevc/i.test(s)) return 'HEVC-DASH';
  if (/\.mpd/i.test(s)) return 'DASH';
  if (/\.m3u8|\/hls\//i.test(s)) return 'HLS';
  return 'other';
}

async function probe(t) {
  const url = `${BASE}/extract?type=movie&imdbId=${t.imdb}&tmdbId=${t.tmdb}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url);
    const body = await res.json();
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    if (body.url) {
      return `${t.name}\n   ${secs}s  ${body.provider}  ${body.kind}  ${shapeOf(body.url)}\n   ${(body.url || '').slice(0, 260)}`;
    }
    const diags = (body.debug || [])
      .map((d) => `${d.provider || d.skipped}:${d.mainStatus ?? '-'}${d.navError ? '/nav' : ''}${d.browserError ? '/browser' : ''}`)
      .join(' ');
    return `${t.name}\n   ${secs}s  NO SOURCE  [${diags}]`;
  } catch (e) {
    return `${t.name}\n   ERROR ${(e.message || e).slice(0, 100)}`;
  }
}

(async () => {
  console.log(`probing ${BASE}\n`);
  for (const t of TITLES) console.log((await probe(t)) + '\n');
})();
