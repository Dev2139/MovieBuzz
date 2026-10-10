import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const TMDB_API_KEY = process.env.TMDB_API_KEY || '5dbb265bcf35f217cf70ac66d54fd125';
const TMDB_IMAGE_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMAGE_BASE_BACKDROP = 'https://image.tmdb.org/t/p/w1280';

const GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10765: 'Sci-Fi & Fantasy',
};

function cleanTitle(raw: string): string {
  let t = raw;
  t = t.replace(/[\(\[]?\b(19\d{2}|20\d{2})\b[\)\]]?/g, ' ');
  t = t.replace(/\b(1080p|720p|480p|4K|2160p|FHD|HD|SD|WEB-?DL|WEBRip|BluRay|BRRip|PreDVDRip|DVDRip|HDRip|Theatre Print|Print|HQ|CAMRip|x264|x265|HEVC|10Bit|AAC|ESub|MSub)\b/gi, ' ');
  t = t.replace(/\b(Dual Audio|Multi Audio|Hindi|Malayalam|Tamil|Telugu|Kannada|English|Bengali|Marathi|Punjabi|Spanish|Dubbed|Org Audio|ORG)\b/gi, ' ');
  t = t.replace(/\b(S\d{1,2}\s*E\d{1,2}|Season\s*\d+|Episode\s*\d+|Ep\s*\d+)\b/gi, ' ');
  t = t.replace(/#[a-z0-9_]+/gi, ' ');
  t = t.replace(/[:\-_+\/\\|,]+/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t || raw;
}

async function queryTMDB(title: string, year?: number, isSeries?: boolean) {
  const cTitle = cleanTitle(title);
  const endpoint = isSeries ? 'search/tv' : 'search/movie';

  let results: any[] = [];

  // Try with year
  if (year) {
    const yearParam = isSeries ? `&first_air_date_year=${year}` : `&primary_release_year=${year}`;
    const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cTitle)}${yearParam}&include_adult=false`;
    const res = await axios.get(url, { timeout: 6000 }).catch(() => null);
    if (res?.data?.results?.length) {
      results = res.data.results;
    }
  }

  // Fallback without year
  if (results.length === 0) {
    const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cTitle)}&include_adult=false`;
    const res = await axios.get(url, { timeout: 6000 }).catch(() => null);
    if (res?.data?.results?.length) {
      results = res.data.results;
    }
  }

  // Fallback multi
  if (results.length === 0) {
    const multiUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cTitle)}&include_adult=false`;
    const res = await axios.get(multiUrl, { timeout: 6000 }).catch(() => null);
    if (res?.data?.results?.length) {
      results = res.data.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
    }
  }

  if (results.length === 0) return null;

  // Prioritize matching release year, then highest popularity
  results.sort((a: any, b: any) => {
    const aY = parseInt((a.release_date || a.first_air_date || '').slice(0, 4), 10);
    const bY = parseInt((b.release_date || b.first_air_date || '').slice(0, 4), 10);
    if (year && aY === year && bY !== year) return -1;
    if (year && bY === year && aY !== year) return 1;
    return (b.popularity || 0) - (a.popularity || 0);
  });

  const top = results[0];
  const isTv = top.media_type === 'tv' || isSeries;
  const tmdbId = top.id;

  const detailsUrl = `https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
  const dRes = await axios.get(detailsUrl, { timeout: 6000 }).catch(() => null);
  const details = dRes?.data || top;

  const posterPath = details.poster_path || top.poster_path;
  const backdropPath = details.backdrop_path || top.backdrop_path;

  const releaseDateStr = isTv
    ? (details.first_air_date || top.first_air_date)
    : (details.release_date || top.release_date);

  const releaseYearResolved = releaseDateStr
    ? parseInt(releaseDateStr.split('-')[0], 10)
    : (year || 2026);

  let rating = 0;
  if (typeof details.vote_average === 'number' && details.vote_average > 0) {
    rating = Number(details.vote_average.toFixed(1));
  } else if (typeof top.vote_average === 'number' && top.vote_average > 0) {
    rating = Number(top.vote_average.toFixed(1));
  }

  const genres: string[] = details.genres
    ? details.genres.map((g: any) => g.name)
    : (top.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean);

  const cast: string[] = details.credits?.cast
    ? details.credits.cast.slice(0, 6).map((c: any) => c.name)
    : [];

  const director = details.credits?.crew
    ? details.credits.crew.find((c: any) => c.job === 'Director')?.name || 'Director'
    : 'Director';

  return {
    title: isTv ? (details.name || top.name || cTitle) : (details.title || top.title || cTitle),
    description: details.overview || top.overview,
    posterUrl: posterPath ? `${TMDB_IMAGE_BASE_POSTER}${posterPath}` : undefined,
    backdropUrl: backdropPath ? `${TMDB_IMAGE_BASE_BACKDROP}${backdropPath}` : undefined,
    releaseDate: releaseDateStr ? new Date(releaseDateStr) : (releaseYearResolved ? new Date(`${releaseYearResolved}-01-01`) : undefined),
    releaseYear: releaseYearResolved,
    rating,
    genres: genres.length > 0 ? genres : undefined,
    cast: cast.length > 0 ? cast : undefined,
    director,
  };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URI found!');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('[Enricher] Connected to MongoDB');

  const Content = mongoose.model('Content', new mongoose.Schema({}, { strict: false }));
  const all = await Content.find({});
  console.log(`[Enricher] Found ${all.length} total items in DB to check & enrich...`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < all.length; i++) {
    const item = all[i] as any;
    const title = item.title;
    const year = item.releaseYear;
    const isSeries = item.type === 'series';

    try {
      const meta = await queryTMDB(title, year, isSeries);
      if (meta) {
        const updateData: any = {};
        if (meta.releaseDate) updateData.releaseDate = meta.releaseDate;
        if (meta.releaseYear) updateData.releaseYear = meta.releaseYear;
        if (meta.rating > 0) updateData.rating = meta.rating;
        if (meta.posterUrl && !meta.posterUrl.includes('unsplash')) updateData.posterUrl = meta.posterUrl;
        if (meta.backdropUrl && !meta.backdropUrl.includes('unsplash')) updateData.backdropUrl = meta.backdropUrl;
        if (meta.description && meta.description.length > 10) updateData.description = meta.description;
        if (meta.genres) updateData.genres = meta.genres;
        if (meta.cast) updateData.cast = meta.cast;
        if (meta.director) updateData.director = meta.director;

        await Content.findByIdAndUpdate(item._id, { $set: updateData });
        updatedCount++;
        console.log(`[${i + 1}/${all.length}] Updated "${title}" -> Year: ${meta.releaseYear}, Date: ${meta.releaseDate?.toISOString().slice(0, 10)}, Rating: ${meta.rating}`);
      } else {
        // Even if TMDB didn't match, give it an approximate releaseDate from releaseYear so sorting works!
        if (!item.releaseDate && item.releaseYear) {
          await Content.findByIdAndUpdate(item._id, { $set: { releaseDate: new Date(`${item.releaseYear}-01-01`) } });
        }
        skippedCount++;
        console.log(`[${i + 1}/${all.length}] No TMDB match for "${title}" (${year})`);
      }
    } catch (err: any) {
      console.warn(`[${i + 1}/${all.length}] Error processing "${title}":`, err.message);
    }

    // Small delay to prevent TMDB rate limiting
    if (i % 10 === 0 && i > 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`=======================================================`);
  console.log(`🎉 Enrichment complete! Updated: ${updatedCount}, Skipped: ${skippedCount}`);
  console.log(`=======================================================`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
