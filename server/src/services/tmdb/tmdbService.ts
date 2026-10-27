import axios from 'axios';

export interface EnrichedMetadata {
  title: string;
  originalTitle?: string;
  description: string;
  posterUrl: string;
  backdropUrl: string;
  rating: number;
  releaseYear: number;
  releaseDate?: string;
  genres: string[];
  languages: string[];
  cast: string[];
  director: string;
  type: 'movie' | 'series';
  tmdbId?: number;
  imdbId?: string;
}

const TMDB_IMAGE_BASE_POSTER = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMAGE_BASE_BACKDROP = 'https://image.tmdb.org/t/p/w1280';

const FALLBACK_POSTERS = [
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800',
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
];

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

export interface CleanTitleResult {
  cleanTitle: string;
  coreTitle: string;
  extractedYear?: number;
}

export function cleanMovieTitle(rawTitle: string): CleanTitleResult {
  if (!rawTitle) {
    return { cleanTitle: '', coreTitle: '', extractedYear: undefined };
  }

  let text = String(rawTitle).trim();

  // 1. Remove trailing file extensions e.g. .mkv, .mp4, or trailing word 'mkv'
  text = text.replace(/\.(mkv|mp4|avi|mov|wmv|webm|ts|m4v|flv)$/i, '');
  text = text.replace(/\s+\b(mkv|mp4|avi|mov|wmv|webm|ts)\b$/i, '');

  // 2. Convert dots and underscores in filenames to spaces (e.g. Men.in.Black.3 -> Men in Black 3)
  text = text.replace(/[\._]/g, ' ');

  // 3. Extract 4-digit release year (1900-2099)
  let extractedYear: number | undefined;
  const yearRegex = /(?:[\(\[]\s*)?\b(19\d{2}|20\d{2})\b(?:\s*[\)\]])?/;
  const yearMatch = text.match(yearRegex);
  if (yearMatch) {
    extractedYear = parseInt(yearMatch[1], 10);
  }

  // 4. Detect Season/Episode markers (e.g. S01E02, Season 1)
  const sAndEMatch = text.match(/\b(S\d{1,2}\s*E\d{1,2}|Season\s*\d+|Episode\s*\d+|Ep\s*\d+)\b/i);

  // 5. Detect video quality & scene tags
  const qualityMarker = text.match(/\b(2160p|1080p|720p|480p|4k|uhd|fhd|bluray|bdrip|brrip|web-?dl|web-?rip|dvdrip|theatre\s*print|predvdrip|camrip|hdcam|10bit|8bit|12bit|x264|x265|hevc|avc|h\.?264|h\.?265)\b/i);

  // 6. Intelligent cutoff boundary: Scene filenames follow [Movie Title] [(Year) or (Season)] [Technical Tags]
  // Anything after year, season, or quality tags is technical metadata (e.g. "10bit Bluray x265 HEVC [Org BD 5 mkv")
  let cutoffIndex = -1;
  if (yearMatch && yearMatch.index !== undefined && yearMatch.index >= 2) {
    cutoffIndex = yearMatch.index;
  }
  if (sAndEMatch && sAndEMatch.index !== undefined && sAndEMatch.index >= 2) {
    if (cutoffIndex === -1 || sAndEMatch.index < cutoffIndex) {
      cutoffIndex = sAndEMatch.index;
    }
  }
  if (qualityMarker && qualityMarker.index !== undefined && qualityMarker.index >= 2) {
    if (cutoffIndex === -1 || qualityMarker.index < cutoffIndex) {
      cutoffIndex = qualityMarker.index;
    }
  }

  let title = text;
  if (cutoffIndex > 0) {
    title = text.slice(0, cutoffIndex);
  }

  // 7. Strip leftover brackets, scene tags, hashtags, and punctuation
  title = title.replace(/\[.*?\]/g, ' ');
  title = title.replace(/\(.*?\)/g, ' ');
  title = title.replace(/\{.*?\}/g, ' ');
  title = title.replace(/\[.*$/g, ' ');
  title = title.replace(/\(.*$/g, ' ');
  title = title.replace(/#[a-z0-9_]+/gi, ' ');
  title = title.replace(/\b(1080p|720p|480p|4k|2160p|uhd|fhd|hd|sd|10bit|8bit|12bit|hdr10\+|hdr10|hdr|dovi|dv|bluray|bdrip|brrip|web-?dl|web-?rip|dvdrip|theatre\s*print|predvdrip|hq|camrip|x264|x265|hevc|avc|dual\s*audio|multi\s*audio|org\s*audio|org\s*bd|dts|truehd|atmos|ddp|ac3|aac|5\.1|7\.1|esub|msub|proper|repack|yts|yify|mkv|mp4)\b/gi, ' ');
  title = title.replace(/[\-–—:_|/\\]+$/g, ' ');
  title = title.replace(/^[\-–—:_|/\\]+/g, ' ');
  title = title.replace(/\s+/g, ' ').trim();

  const cleanTitle = title || text.replace(/[\._]/g, ' ').replace(/\s+/g, ' ').trim() || rawTitle;

  // 8. Core title: If title has a colon, dash, or pipe separating a subtitle, isolate primary name
  // e.g. "Mission: Impossible - Fallout" -> "Mission Impossible"
  let coreTitle = cleanTitle;
  const subDivider = cleanTitle.split(/[:\-|]/);
  if (subDivider.length > 1 && subDivider[0].trim().length >= 3) {
    coreTitle = subDivider[0].trim();
  }

  return {
    cleanTitle,
    coreTitle,
    extractedYear,
  };
}

class TMDBService {
  private apiKey: string;
  private omdbApiKey: string;

  constructor() {
    this.apiKey = process.env.TMDB_API_KEY || '5dbb265bcf35f217cf70ac66d54fd125';
    this.omdbApiKey = process.env.OMDB_API_KEY || '5c5ff641';
  }

  /**
   * Search TMDB and OMDb to fetch official movie/series artwork, ratings & synopsis
   */
  async fetchMetadata(rawTitle: string, year?: number, preferType?: 'movie' | 'series'): Promise<EnrichedMetadata | null> {
    const { cleanTitle, coreTitle, extractedYear } = cleanMovieTitle(rawTitle);
    const targetYear = year || extractedYear;

    try {
      let searchResults: any[] = [];
      const isTvPreferred = preferType === 'series';

      // Step 1: If year is known, search with exact release year filter
      if (targetYear) {
        const endpoint = isTvPreferred ? 'search/tv' : 'search/movie';
        const yearParam = isTvPreferred ? `&first_air_date_year=${targetYear}` : `&primary_release_year=${targetYear}`;
        const yearUrl = `https://api.themoviedb.org/3/${endpoint}?api_key=${this.apiKey}&query=${encodeURIComponent(cleanTitle)}${yearParam}&include_adult=false`;
        const res = await axios.get(yearUrl, { timeout: 6000 }).catch(() => null);
        if (res?.data?.results && res.data.results.length > 0) {
          searchResults = res.data.results.map((r: any) => ({ ...r, media_type: isTvPreferred ? 'tv' : 'movie' }));
        }
      }

      // Step 2: Try specific endpoint without year if step 1 returned no results
      if (searchResults.length === 0) {
        const endpoint = isTvPreferred ? 'search/tv' : 'search/movie';
        const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${this.apiKey}&query=${encodeURIComponent(cleanTitle)}&include_adult=false`;
        const res = await axios.get(url, { timeout: 6000 }).catch(() => null);
        if (res?.data?.results && res.data.results.length > 0) {
          searchResults = res.data.results.map((r: any) => ({ ...r, media_type: isTvPreferred ? 'tv' : 'movie' }));
        }
      }

      // Step 3: Try multi search if still empty
      if (searchResults.length === 0) {
        const multiUrl = `https://api.themoviedb.org/3/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(cleanTitle)}&include_adult=false`;
        const multiRes = await axios.get(multiUrl, { timeout: 6000 }).catch(() => null);
        if (multiRes?.data?.results && multiRes.data.results.length > 0) {
          searchResults = multiRes.data.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
        }
      }

      // Step 4: Retry with coreTitle if cleanTitle gave 0 results
      if (searchResults.length === 0 && coreTitle && coreTitle !== cleanTitle) {
        const coreUrl = `https://api.themoviedb.org/3/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(coreTitle)}&include_adult=false`;
        const coreRes = await axios.get(coreUrl, { timeout: 6000 }).catch(() => null);
        if (coreRes?.data?.results && coreRes.data.results.length > 0) {
          searchResults = coreRes.data.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
        }
      }

      if (searchResults.length > 0) {
        // Sort candidate matches: title similarity FIRST (popularity-only picks
        // made TMDB return unrelated titles, which then played the wrong video),
        // then matching release year, then popularity (vote count / index).
        const reqNorm = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const titleScore = (r: any): number => {
          const t = String(r.title || r.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!reqNorm || !t) return 0;
          if (t === reqNorm) return 3;
          if (t.startsWith(reqNorm) || reqNorm.startsWith(t)) return 2;
          return t.includes(reqNorm) || reqNorm.includes(t) ? 1 : 0;
        };
        searchResults.sort((a: any, b: any) => {
          const ts = titleScore(b) - titleScore(a);
          if (ts !== 0) return ts;
          const aYear = parseInt((a.release_date || a.first_air_date || '').slice(0, 4), 10);
          const bYear = parseInt((b.release_date || b.first_air_date || '').slice(0, 4), 10);
          if (targetYear && aYear === targetYear && bYear !== targetYear) return -1;
          if (targetYear && bYear === targetYear && aYear !== targetYear) return 1;
          return (b.popularity || 0) - (a.popularity || 0);
        });

        const resultItem = searchResults[0];
        const isTv = resultItem.media_type === 'tv' || preferType === 'series';
        const tmdbId = resultItem.id;

        // Fetch detailed info + credits (Cast & Director)
        const detailsUrl = `https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${this.apiKey}&append_to_response=credits`;
        const detailsRes = await axios.get(detailsUrl, { timeout: 6000 }).catch(() => null);
        const details = detailsRes?.data || resultItem;

        const posterUrl = details.poster_path || resultItem.poster_path
          ? `${TMDB_IMAGE_BASE_POSTER}${details.poster_path || resultItem.poster_path}`
          : FALLBACK_POSTERS[0];

        const rawBackdrop = details.backdrop_path || resultItem.backdrop_path;
        const backdropUrl = rawBackdrop && rawBackdrop !== 'null'
          ? `${TMDB_IMAGE_BASE_BACKDROP}${rawBackdrop}`
          : posterUrl;

        const genres: string[] = details.genres
          ? details.genres.map((g: any) => g.name)
          : (resultItem.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean);

        const cast: string[] = details.credits?.cast
          ? details.credits.cast.slice(0, 6).map((c: any) => c.name)
          : [];

        const director = details.credits?.crew
          ? details.credits.crew.find((c: any) => c.job === 'Director')?.name || 'Director'
          : 'Director';

        const releaseDateStr = isTv
          ? (details.first_air_date || resultItem.first_air_date)
          : (details.release_date || resultItem.release_date);

        const releaseYearResolved = releaseDateStr
          ? parseInt(releaseDateStr.split('-')[0], 10)
          : (targetYear || 2026);

        // Real TMDB Rating
        let realRating = 0;
        if (typeof details.vote_average === 'number' && details.vote_average > 0) {
          realRating = Number(details.vote_average.toFixed(1));
        } else if (typeof resultItem.vote_average === 'number' && resultItem.vote_average > 0) {
          realRating = Number(resultItem.vote_average.toFixed(1));
        }

        return {
          title: isTv ? (details.name || resultItem.name || cleanTitle) : (details.title || resultItem.title || cleanTitle),
          originalTitle: isTv ? (details.original_name || resultItem.original_name) : (details.original_title || resultItem.original_title),
          description: details.overview || resultItem.overview || `Watch ${cleanTitle} online in high definition on CineStream.`,
          posterUrl,
          backdropUrl,
          rating: realRating,
          releaseYear: releaseYearResolved,
          releaseDate: releaseDateStr || undefined,
          genres: genres.length > 0 ? genres : ['Action', 'Drama', 'Cinema'],
          languages: (details.original_language || resultItem.original_language)
            ? [(details.original_language || resultItem.original_language).toUpperCase()]
            : ['English'],
          cast: cast.length > 0 ? cast : ['Popular Cast'],
          director,
          type: isTv ? 'series' : 'movie',
          tmdbId,
          imdbId: details.imdb_id,
        };
      }
    } catch (err: any) {
      console.warn(`[TMDBService] TMDB lookup notice for "${cleanTitle}":`, err.message);
    }

    // OMDb API Fallback (with 401 handling)
    try {
      if (this.omdbApiKey && this.omdbApiKey.length > 3) {
        const yearParam = targetYear ? `&y=${targetYear}` : '';
        let omdbUrl = `http://www.omdbapi.com/?apikey=${this.omdbApiKey}&t=${encodeURIComponent(cleanTitle)}${yearParam}`;
        let omdbRes = await axios.get(omdbUrl, { timeout: 5000 }).catch(() => null);

        // Retry with coreTitle if cleanTitle failed
        if ((!omdbRes?.data || omdbRes.data.Response !== 'True') && coreTitle && coreTitle !== cleanTitle) {
          omdbUrl = `http://www.omdbapi.com/?apikey=${this.omdbApiKey}&t=${encodeURIComponent(coreTitle)}${yearParam}`;
          omdbRes = await axios.get(omdbUrl, { timeout: 5000 }).catch(() => null);
        }

        if (omdbRes?.data && omdbRes.data.Response === 'True') {
          const data = omdbRes.data;
          const posterUrl = data.Poster && data.Poster.startsWith('http') ? data.Poster : FALLBACK_POSTERS[1];
          const imdbRating = parseFloat(data.imdbRating);

          return {
            title: data.Title || cleanTitle,
            description: data.Plot && data.Plot !== 'N/A' ? data.Plot : `Stream ${cleanTitle} on CineStream.`,
            posterUrl,
            backdropUrl: posterUrl,
            rating: !isNaN(imdbRating) ? imdbRating : 8.4,
            releaseYear: parseInt(data.Year, 10) || targetYear || 2026,
            genres: data.Genre && data.Genre !== 'N/A' ? data.Genre.split(', ') : ['Drama', 'Thriller'],
            languages: data.Language && data.Language !== 'N/A' ? data.Language.split(', ') : ['English'],
            cast: data.Actors && data.Actors !== 'N/A' ? data.Actors.split(', ') : ['Lead Actors'],
            director: data.Director && data.Director !== 'N/A' ? data.Director : 'Director',
            type: data.Type === 'series' ? 'series' : 'movie',
            imdbId: data.imdbID,
          };
        }
      }
    } catch {
      // Ignore OMDB error
    }

    return null;
  }

  /**
   * Map a TMDB id to its IMDb id in one lightweight details call. Embed
   * providers key their catalogue primarily by IMDb id, so resolving streams
   * without it loses titles whose TMDB-numbered page is empty.
   */
  async fetchImdbId(tmdbId: number | string, type: 'movie' | 'series' = 'movie'): Promise<string | undefined> {
    try {
      const url = `https://api.themoviedb.org/3/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}?api_key=${this.apiKey}`;
      const res = await axios.get(url, { timeout: 6000 }).catch(() => null);
      const imdb = res?.data?.imdb_id;
      if (typeof imdb === 'string' && imdb.startsWith('tt')) return imdb;
      if (type === 'movie') {
        // DB "type" is unreliable for imported rows; a tv id queried on the
        // movie endpoint returns 404, so try the other family once.
        const alt = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${this.apiKey}`, { timeout: 6000 }).catch(() => null);
        const altImdb = alt?.data?.imdb_id;
        if (typeof altImdb === 'string' && altImdb.startsWith('tt')) return altImdb;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Fetch complete real-world TV seasons & episodes list with official titles, stills and descriptions
   */
  async fetchSeriesSeasonsEpisodes(rawTitle: string, year?: number, knownTmdbId?: number) {
    const { cleanTitle } = cleanMovieTitle(rawTitle);
    try {
      let tmdbId = knownTmdbId;
      if (!tmdbId) {
        const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${this.apiKey}&query=${encodeURIComponent(cleanTitle)}&include_adult=false`;
        const res = await axios.get(searchUrl, { timeout: 6000 }).catch(() => null);
        const results = res?.data?.results || [];
        if (results.length > 0) {
          if (year) {
            const yMatch = results.find((r: any) => (r.first_air_date || '').startsWith(String(year)));
            tmdbId = yMatch ? yMatch.id : results[0].id;
          } else {
            tmdbId = results[0].id;
          }
        }
      }

      if (!tmdbId) return null;

      const tvDetailsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${this.apiKey}`;
      const tvRes = await axios.get(tvDetailsUrl, { timeout: 6000 }).catch(() => null);
      if (!tvRes?.data) return null;

      const tvData = tvRes.data;
      const rawSeasons: any[] = (tvData.seasons || []).filter((s: any) => s.season_number > 0);
      const defaultBackdrop = tvData.backdrop_path
        ? `${TMDB_IMAGE_BASE_BACKDROP}${tvData.backdrop_path}`
        : (tvData.poster_path ? `${TMDB_IMAGE_BASE_POSTER}${tvData.poster_path}` : '');

      const seasons = await Promise.all(
        rawSeasons.slice(0, 10).map(async (s: any) => {
          const sNum = s.season_number;
          const sUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${sNum}?api_key=${this.apiKey}`;
          const sRes = await axios.get(sUrl, { timeout: 6000 }).catch(() => null);
          const rawEpisodes: any[] = sRes?.data?.episodes || [];

          const episodes = rawEpisodes.map((ep: any) => ({
            seasonNumber: sNum,
            episodeNumber: ep.episode_number,
            title: ep.name || `Episode ${ep.episode_number}`,
            description: ep.overview || `${tvData.name} — Season ${sNum}, Episode ${ep.episode_number}`,
            thumbnailUrl: ep.still_path
              ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
              : (s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : defaultBackdrop),
            duration: (ep.runtime || 45) * 60,
          }));

          return {
            seasonNumber: sNum,
            title: s.name || `Season ${sNum}`,
            episodeCount: s.episode_count || episodes.length,
            episodes,
          };
        })
      );

      return {
        tmdbId,
        title: tvData.name || cleanTitle,
        description: tvData.overview,
        backdropUrl: defaultBackdrop,
        totalSeasons: seasons.length,
        totalEpisodes: seasons.reduce((sum: number, s: any) => sum + s.episodeCount, 0),
        seasons,
      };
    } catch (err: any) {
      console.warn('fetchSeriesSeasonsEpisodes err:', err.message);
      return null;
    }
  }
}

export const tmdbService = new TMDBService();
