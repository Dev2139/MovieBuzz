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

// Fallback high quality cinematic posters if query fails
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

class TMDBService {
  private apiKey: string;
  private omdbApiKey: string;

  constructor() {
    this.apiKey = process.env.TMDB_API_KEY || '4f8d24115546d5386f777e1136709848'; // standard TMDB key
    this.omdbApiKey = process.env.OMDB_API_KEY || 'trilogy';
  }

  /**
   * Search TMDB and OMDb to fetch official movie/series artwork, ratings & synopsis
   */
  async fetchMetadata(title: string, year?: number, preferType?: 'movie' | 'series'): Promise<EnrichedMetadata | null> {
    const cleanTitle = title
      .replace(/S\d+E\d+/gi, '')
      .replace(/Season \d+/gi, '')
      .replace(/\b(1080p|720p|4K|2160p|Dual Audio|Hindi|Malayalam|Tamil|Telugu|English)\b/gi, '')
      .trim();

    try {
      // 1. Try TMDB Search First
      const searchType = preferType === 'series' ? 'tv' : 'movie';
      const tmdbUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${this.apiKey}&query=${encodeURIComponent(
        cleanTitle
      )}${year ? `&year=${year}` : ''}`;

      const res = await axios.get(tmdbUrl, { timeout: 6000 }).catch(() => null);

      let resultItem: any = null;
      if (res?.data?.results && res.data.results.length > 0) {
        resultItem = res.data.results[0];
      } else {
        // Retry without year constraint or search multi
        const multiUrl = `https://api.themoviedb.org/3/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(cleanTitle)}`;
        const multiRes = await axios.get(multiUrl, { timeout: 6000 }).catch(() => null);
        if (multiRes?.data?.results && multiRes.data.results.length > 0) {
          resultItem = multiRes.data.results[0];
        }
      }

      if (resultItem) {
        const isTv = resultItem.media_type === 'tv' || searchType === 'tv';
        const tmdbId = resultItem.id;

        // Fetch detailed info + credits (Cast & Director)
        const detailsUrl = `https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${this.apiKey}&append_to_response=credits`;
        const detailsRes = await axios.get(detailsUrl, { timeout: 6000 }).catch(() => null);
        const details = detailsRes?.data || resultItem;

        const posterUrl = resultItem.poster_path
          ? `${TMDB_IMAGE_BASE_POSTER}${resultItem.poster_path}`
          : FALLBACK_POSTERS[0];
        const backdropUrl = resultItem.backdrop_path
          ? `${TMDB_IMAGE_BASE_BACKDROP}${resultItem.backdrop_path}`
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
          title: isTv ? resultItem.name || title : resultItem.title || title,
          originalTitle: isTv ? resultItem.original_name : resultItem.original_title,
          description: resultItem.overview || `Watch ${title} online in high definition on CineStream.`,
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

    // 2. OMDb API Fallback for IMDb ratings & details
    try {
      const omdbUrl = `http://www.omdbapi.com/?apikey=${this.omdbApiKey}&t=${encodeURIComponent(cleanTitle)}${
        year ? `&y=${year}` : ''
      }`;
      const omdbRes = await axios.get(omdbUrl, { timeout: 5000 }).catch(() => null);

      if (omdbRes?.data && omdbRes.data.Response === 'True') {
        const data = omdbRes.data;
        const posterUrl = data.Poster && data.Poster.startsWith('http') ? data.Poster : FALLBACK_POSTERS[1];
        const imdbRating = parseFloat(data.imdbRating);

        return {
          title: data.Title || title,
          description: data.Plot && data.Plot !== 'N/A' ? data.Plot : `Stream ${title} on CineStream.`,
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
    } catch (err: any) {
      console.warn(`[TMDBService] OMDb lookup notice:`, err.message);
    }

    return null;
  }
}

export const tmdbService = new TMDBService();
