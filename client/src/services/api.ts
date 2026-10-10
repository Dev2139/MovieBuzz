import axios from 'axios';
import { Content, Season, Episode, Media, User, WatchHistoryItem, AdminStats, TelegramImportItem, ContentRequest, AdminCatalogResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://moviebuzz-99fb.onrender.com/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token from localStorage if set (in case cookies are blocked by browser third-party rules)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cinestream_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept server errors (5xx, 429, network failures) to trigger heavy traffic screen
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!axios.isCancel(error)) {
      const status = error?.response?.status;
      const isNetworkError = !error?.response && Boolean(error?.code || error?.message);
      const isServerError = Boolean(status && (status >= 500 || status === 429));

      if (isServerError || isNetworkError) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cinestream:server-error', {
              detail: {
                status: status || 503,
                message: error?.response?.data?.message || error?.message || 'Server traffic capacity reached',
                url: error?.config?.url,
              },
            })
          );
        }
      }
    }
    return Promise.reject(error);
  }
);

// --- Content & Catalog APIs ---
export const fetchContentList = async (params?: Record<string, any>) => {
  const res = await api.get<{ items: Content[]; total: number; page: number; totalPages: number }>('/content', { params });
  return res.data;
};

export const fetchContentBySlug = async (slug: string) => {
  const res = await api.get<{ content: Content; media: Media[] }>(`/content/${slug}`);
  return res.data;
};

export const fetchMovies = async (params?: Record<string, any>) => {
  const res = await api.get<{ items: Content[]; total: number; page: number; totalPages: number }>('/movies', { params });
  return res.data;
};

export const fetchSeries = async (params?: Record<string, any>) => {
  const res = await api.get<{ items: Content[]; total: number; page: number; totalPages: number }>('/series', { params });
  return res.data;
};

export const fetchGenres = async () => {
  const res = await api.get<{ genres: string[] }>('/genres');
  return res.data;
};

// --- Series & Seasons APIs ---
export const fetchSeriesSeasons = async (seriesId: string) => {
  const res = await api.get<{ seasons: Season[] }>(`/series/${seriesId}/seasons`);
  return res.data;
};

export const fetchSeasonEpisodes = async (seasonId: string) => {
  const res = await api.get<{ episodes: Episode[] }>(`/seasons/${seasonId}/episodes`);
  return res.data;
};

export const fetchEpisodeById = async (episodeId: string) => {
  const res = await api.get<{ episode: Episode; media: Media[]; playlist: Episode[] }>(`/episodes/${episodeId}`);
  return res.data;
};

export const fetchSeriesEpisodeByNumber = async (seriesSlug: string, seasonNumber: number, episodeNumber: number) => {
  const res = await api.get<{ series: Content; season: Season; episode: Episode; media: Media[]; playlist: Episode[] }>(
    `/series-watch/${seriesSlug}/${seasonNumber}/${episodeNumber}`
  );
  return res.data;
};

// --- Media & Download APIs ---
export const fetchMediaStream = async (mediaId: string) => {
  const res = await api.get<{ streamUrl: string; mediaId: string; quality: string }>(`/media/${mediaId}/watch`);
  return res.data;
};

export const fetchMediaDownloadLink = async (mediaId: string) => {
  const res = await api.get<{ downloadUrl: string; quality: string; fileSize: string }>(`/media/${mediaId}/download`);
  return res.data;
};

// --- Search API ---
export const searchCatalog = async (query: string) => {
  const res = await api.get<{ movies: Content[]; series: Content[]; episodes: Episode[]; query: string }>('/search', {
    params: { q: query },
  });
  return res.data;
};

// --- User APIs (Auth Required) ---
export const fetchContinueWatching = async () => {
  const res = await api.get<{ continueWatching: WatchHistoryItem[] }>('/users/continue-watching');
  return res.data;
};

export const fetchUserHistory = async () => {
  const res = await api.get<{ history: WatchHistoryItem[] }>('/users/history');
  return res.data;
};

export const saveWatchProgress = async (data: {
  contentId: string;
  episodeId?: string;
  progress: number;
  duration: number;
  completed?: boolean;
}) => {
  const res = await api.post('/users/history', data);
  return res.data;
};

export const deleteHistoryItemApi = async (historyId: string) => {
  const res = await api.delete(`/users/history/${historyId}`);
  return res.data;
};

export const clearUserHistoryApi = async () => {
  const res = await api.delete('/users/history');
  return res.data;
};

export const fetchUserFavorites = async () => {
  const res = await api.get<{ favorites: Content[] }>('/users/favorites');
  return res.data;
};

export const toggleFavoriteApi = async (contentId: string) => {
  const res = await api.post<{ isFavorite: boolean }>(`/users/favorites/${contentId}`);
  return res.data;
};

export const fetchUserWatchlist = async () => {
  const res = await api.get<{ watchlist: Content[] }>('/users/watchlist');
  return res.data;
};

export const toggleWatchlistApi = async (contentId: string) => {
  const res = await api.post<{ inWatchlist: boolean }>(`/users/watchlist/${contentId}`);
  return res.data;
};

export const migrateLocalDataApi = async (payload: {
  localHistory: any[];
  localWatchlist: string[];
  localFavorites: string[];
}) => {
  const res = await api.post('/users/migrate-local-data', payload);
  return res.data;
};

// --- Admin APIs ---
export const fetchAdminStats = async () => {
  const res = await api.get<AdminStats>('/admin/stats');
  return res.data;
};

export const createMovieApi = async (movieData: any) => {
  const res = await api.post('/admin/movies', movieData);
  return res.data;
};

export const createSeriesApi = async (seriesData: any) => {
  const res = await api.post('/admin/series', seriesData);
  return res.data;
};

export const createSeasonApi = async (seasonData: any) => {
  const res = await api.post('/admin/seasons', seasonData);
  return res.data;
};

export const createEpisodeApi = async (episodeData: any) => {
  const res = await api.post('/admin/episodes', episodeData);
  return res.data;
};

export const deleteContentApi = async (contentId: string) => {
  const res = await api.delete(`/admin/content/${contentId}`);
  return res.data;
};

export const updateContentApi = async ({ id, data }: { id: string; data: any }) => {
  const res = await api.put(`/admin/content/${id}`, data);
  return res.data;
};

// Telegram Import APIs
export const fetchTelegramImports = async (status?: string) => {
  const res = await api.get<{ imports: TelegramImportItem[] }>('/admin/telegram/imports', { params: { status } });
  return res.data;
};

export const syncTelegramChannelApi = async () => {
  const res = await api.post('/admin/telegram/sync');
  return res.data;
};

export const parseTelegramPostApi = async (caption: string) => {
  const res = await api.post('/admin/telegram/parse', { caption });
  return res.data;
};

export const publishTelegramImportApi = async (payload: any) => {
  const res = await api.post('/admin/telegram/publish', payload);
  return res.data;
};

export const enrichCatalogApi = async () => {
  const res = await api.post<{ message: string; enrichedCount: number }>('/admin/enrich');
  return res.data;
};

// --- User Content Requests APIs ---
export const submitContentRequestApi = async (data: {
  title: string;
  type?: 'movie' | 'series';
  releaseYear?: number;
  notes?: string;
  userName?: string;
  userEmail?: string;
}) => {
  const res = await api.post<{ message: string; request: ContentRequest }>('/requests', data);
  return res.data;
};

// --- Admin Content Requests Management APIs ---
export const fetchAdminRequestsApi = async (params?: {
  status?: string;
  type?: string;
  search?: string;
}) => {
  const res = await api.get<{
    requests: ContentRequest[];
    total: number;
    counts: { pending: number; fulfilled: number; rejected: number };
  }>('/admin/requests', { params });
  return res.data;
};

export const updateAdminRequestApi = async ({
  id,
  status,
  adminNotes,
}: {
  id: string;
  status?: 'pending' | 'fulfilled' | 'rejected';
  adminNotes?: string;
}) => {
  const res = await api.put<{ message: string; request: ContentRequest }>(`/admin/requests/${id}`, {
    status,
    adminNotes,
  });
  return res.data;
};

export const deleteAdminRequestApi = async (id: string) => {
  const res = await api.delete<{ message: string }>(`/admin/requests/${id}`);
  return res.data;
};

export const fetchAdminCatalogApi = async (params?: {
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number | string;
  sort?: string;
}) => {
  const res = await api.get<AdminCatalogResponse>('/admin/catalog', { params });
  return res.data;
};

// --- MovieBox Streaming Source APIs ---
export const fetchStreamingSearch = async (query: string, type: 'movie' | 'series' | 'all' = 'all') => {
  const res = await api.get<{ query: string; results: any[]; count: number }>('/streaming/search', {
    params: { q: query, type },
  });
  return res.data;
};

export const fetchMovieStreamingSources = async (subjectId: string) => {
  const res = await api.get<{ subjectId: string; count: number; sources: any[] }>(`/streaming/movies/${subjectId}/sources`);
  return res.data;
};

export const fetchEpisodeStreamingSources = async (subjectId: string, season: number = 1, episode: number = 1) => {
  const res = await api.get<{ subjectId: string; season: number; episode: number; count: number; sources: any[] }>(
    `/streaming/episodes/${subjectId}/sources`,
    { params: { season, episode } }
  );
  return res.data;
};

export const resolveStreamingSourcesByTitle = async (
  title: string,
  year?: number,
  type: 'movie' | 'series' = 'movie',
  season: number = 1,
  episode: number = 1
) => {
  const res = await api.get<{ subject: any; sources: any[] }>('/streaming/resolve', {
    params: { title, year, type, season, episode },
  });
  return res.data;
};

