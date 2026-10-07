import axios from 'axios';

export interface EnrichedMetadata {
  title: string;
  originalTitle?: string;
  description: string;
  posterUrl: string;
  backdropUrl: string;
  rating: number;
  releaseYear: number;
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

export function cleanMovieTitle(rawTitle: string): { cleanTitle: string; coreTitle: string } {
  let title = rawTitle;

  // 1. Remove parenthetical years e.g. (2026), [2021]
  title = title.replace(/[\(\[]?\b(19\d{2}|20\d{2})\b[\)\]]?/g, ' ');

  // 2. Remove video quality & source tags
  title = title.replace(/\b(1080p|720p|480p|4K|2160p|FHD|HD|SD|WEB-?DL|WEBRip|BluRay|BRRip|PreDVDRip|DVDRip|HDRip|Theatre Print|Print|HQ|CAMRip|x264|x265|HEVC|10Bit|AAC|ESub|MSub)\b/gi, ' ');

  // 3. Remove language & audio tags
  title = title.replace(/\b(Dual Audio|Multi Audio|Hindi|Malayalam|Tamil|Telugu|Kannada|English|Bengali|Marathi|Punjabi|Spanish|Dubbed|Org Audio|ORG)\b/gi, ' ');

  // 4. Remove season/episode tags
  title = title.replace(/\b(S\d{1,2}\s*E\d{1,2}|Season\s*\d+|Episode\s*\d+|Ep\s*\d+)\b/gi, ' ');

  // 5. Remove hashtags & unwanted symbols
  title = title.replace(/#[a-z0-9_]+/gi, ' ');
  title = title.replace(/[:\-_+\/\\|,]+/g, ' ');
  title = title.replace(/\s+/g, ' ').trim();

  // Core title (first 3-4 main words before colons or dashes)
  const words = title.split(' ').filter(Boolean);
  const coreTitle = words.slice(0, 3).join(' ').trim();

  return {
    cleanTitle: title || rawTitle,
    coreTitle: coreTitle || title || rawTitle,
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
    const { cleanTitle, coreTitle } = cleanMovieTitle(rawTitle);

    try {
      // Step A: Search TMDB Multi search using cleanTitle
      let searchResults: any[] = [];
      const multiUrl = `https://api.themoviedb.org/3/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(cleanTitle)}`;
      const multiRes = await axios.get(multiUrl, { timeout: 6000 }).catch(() => null);

      if (multiRes?.data?.results && multiRes.data.results.length > 0) {
        searchResults = multiRes.data.results;
      } else if (coreTitle && coreTitle !== cleanTitle) {
        // Step B: Retry with coreTitle if full cleanTitle returned 0
        const coreUrl = `https://api.themoviedb.org/3/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(coreTitle)}`;
        const coreRes = await axios.get(coreUrl, { timeout: 6000 }).catch(() => null);
        if (coreRes?.data?.results && coreRes.data.results.length > 0) {
          searchResults = coreRes.data.results;
        }
      }

      // Step C: Fallback to movie-specific search
      if (searchResults.length === 0) {
        const movieUrl = `https://api.themoviedb.org/3/search/movie?api_key=${this.apiKey}&query=${encodeURIComponent(cleanTitle)}`;
        const movieRes = await axios.get(movieUrl, { timeout: 6000 }).catch(() => null);
        if (movieRes?.data?.results && movieRes.data.results.length > 0) {
          searchResults = movieRes.data.results;
        }
      }

      if (searchResults.length > 0) {
        const resultItem = searchResults[0];
        const isTv = resultItem.media_type === 'tv' || preferType === 'series';
        const tmdbId = resultItem.id;

        // Fetch detailed info + credits (Cast & Director)
        const detailsUrl = `https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${this.apiKey}&append_to_response=credits`;
        const detailsRes = await axios.get(detailsUrl, { timeout: 6000 }).catch(() => null);
        const details = detailsRes?.data || resultItem;

        const posterUrl = resultItem.poster_path
          ? `${TMDB_IMAGE_BASE_POSTER}${resultItem.poster_path}`
          : FALLBACK_POSTERS[0];

        const rawBackdrop = resultItem.backdrop_path || details.backdrop_path;
        const backdropUrl = rawBackdrop && rawBackdrop !== 'null'
          ? `${TMDB_IMAGE_BASE_BACKDROP}${rawBackdrop}`
          : posterUrl;

        const genres: string[] = details.genres
          ? details.genres.map((g: any) => g.name)
          : (resultItem.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean);

        const cast: string[] = details.credits?.cast
          ? details.credits.cast.slice(0, 5).map((c: any) => c.name)
          : [];

        const director = details.credits?.crew
          ? details.credits.crew.find((c: any) => c.job === 'Director')?.name || 'Director'
          : 'Director';

        const releaseDateStr = isTv ? resultItem.first_air_date : resultItem.release_date;
        const releaseYearResolved = releaseDateStr ? parseInt(releaseDateStr.split('-')[0], 10) : year || 2026;

        return {
          title: isTv ? resultItem.name || cleanTitle : resultItem.title || cleanTitle,
          originalTitle: isTv ? resultItem.original_name : resultItem.original_title,
          description: resultItem.overview || details.overview || `Watch ${cleanTitle} online in high definition on CineStream.`,
          posterUrl,
          backdropUrl,
          rating: Number(resultItem.vote_average ? resultItem.vote_average.toFixed(1) : 8.5),
          releaseYear: releaseYearResolved,
          genres: genres.length > 0 ? genres : ['Action', 'Drama', 'Sci-Fi'],
          languages: resultItem.original_language ? [resultItem.original_language.toUpperCase()] : ['English'],
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
        const omdbUrl = `http://www.omdbapi.com/?apikey=${this.omdbApiKey}&t=${encodeURIComponent(cleanTitle)}`;
        const omdbRes = await axios.get(omdbUrl, { timeout: 5000 }).catch(() => null);

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
            releaseYear: parseInt(data.Year, 10) || year || 2026,
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
}

export const tmdbService = new TMDBService();
