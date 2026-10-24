import axios from 'axios';
import { Content, Season, Episode, Media, User, WatchHistoryItem, AdminStats, TelegramImportItem, ContentRequest, AdminCatalogResponse, RecommendationFeed, UserTasteProfile, CoinTransactionItem, RedemptionItem, SubscriptionPlanItem, SubscriberItem, SubscriptionPurchaseItem, LeaderboardRequestItem, AppNotification } from '../types';

const normalizeApiUrl = (raw?: string): string => {
  if (!raw) {
    return typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5000/api'
      : 'https://moviebuzz-qr1i.onrender.com/api';
  }
  let clean = raw.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api')) {
    clean += '/api';
  }
  return clean;
};

const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

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

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
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
  localInterests?: string[];
}) => {
  const res = await api.post('/users/migrate-local-data', payload);
  return res.data;
};

// --- Recommendation & Personalization APIs ---
export const fetchRecommendations = async (params?: {
  genres?: string[];
  historyIds?: string[];
  favoriteIds?: string[];
  watchlistIds?: string[];
  limit?: number;
}) => {
  const queryParams: Record<string, any> = {};
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.genres?.length) queryParams.genres = params.genres.join(',');
  if (params?.historyIds?.length) queryParams.historyIds = params.historyIds.join(',');
  if (params?.favoriteIds?.length) queryParams.favoriteIds = params.favoriteIds.join(',');
  if (params?.watchlistIds?.length) queryParams.watchlistIds = params.watchlistIds.join(',');

  const res = await api.get<{ success: boolean; data: RecommendationFeed }>('/recommendations', {
    params: queryParams,
  });
  return res.data.data;
};

export const fetchSimilarContent = async (slugOrId: string, limit: number = 10) => {
  const res = await api.get<{ success: boolean; items: Content[] }>(`/recommendations/similar/${slugOrId}`, {
    params: { limit },
  });
  return res.data.items;
};

export const fetchUserTasteProfile = async () => {
  const res = await api.get<{ success: boolean; profile: UserTasteProfile }>('/recommendations/taste-profile');
  return res.data.profile;
};

export const updateUserPreferencesApi = async (preferredGenres: string[]) => {
  const res = await api.put<{ success: boolean; message: string; preferredGenres: string[] }>(
    '/users/preferences',
    { preferredGenres }
  );
  return res.data;
};

export const fetchUserPreferencesApi = async () => {
  const res = await api.get<{ preferredGenres: string[]; favoritesCount: number; watchlistCount: number }>(
    '/users/preferences'
  );
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

export const storeSeriesEpisodesApi = async (payload: any) => {
  const res = await api.post('/admin/series/store-episodes', payload);
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
  const res = await api.post<{ message: string; request: ContentRequest; merged?: boolean }>('/requests', data);
  return res.data;
};

// --- Community Requests Leaderboard APIs ---
export const fetchRequestsLeaderboardApi = async (params?: {
  search?: string;
  type?: 'movie' | 'series' | 'all';
}) => {
  const res = await api.get<{ requests: LeaderboardRequestItem[] }>('/requests/leaderboard', { params });
  return res.data;
};

export const voteRequestApi = async (id: string) => {
  const res = await api.post<{ message: string; voteCount: number; hasVoted: boolean }>(
    `/requests/${id}/vote`
  );
  return res.data;
};

// --- Notifications APIs ---
export const fetchNotificationsApi = async () => {
  const res = await api.get<{
    notifications: AppNotification[];
    unreadCount: number;
  }>('/notifications');
  return res.data;
};

export const markNotificationReadApi = async (id: string) => {
  const res = await api.post<{ message: string }>(`/notifications/${id}/read`);
  return res.data;
};

export const markAllNotificationsReadApi = async () => {
  const res = await api.post<{ message: string }>('/notifications/read-all');
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

// --- Admin User Management APIs ---
export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isPremium: boolean;
  createdAt: string;
}

export interface AdminUsersResponse {
  users: AdminUserItem[];
  totalUsers: number;
  totalPremium: number;
  totalNormal: number;
}

export const fetchAdminUsersApi = async (params?: { search?: string; filter?: string }) => {
  const res = await api.get<AdminUsersResponse>('/admin/users', { params });
  return res.data;
};

export const toggleAdminUserPremiumApi = async ({
  userId,
  isPremium,
}: {
  userId: string;
  isPremium?: boolean;
}) => {
  const res = await api.put<{ message: string; user: AdminUserItem }>(`/admin/users/${userId}/premium`, {
    isPremium,
  });
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

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  src: string;
  default?: boolean;
}

export const resolveStreamingSourcesByTitle = async (
  title: string,
  year?: number,
  type: 'movie' | 'series' = 'movie',
  season: number = 1,
  episode: number = 1,
  ids?: { imdbId?: string; tmdbId?: number | string }
) => {
  const res = await api.get<{
    subject: any;
    sources: any[];
    dubs?: Array<{ subjectId: string; name: string; code: string; original?: boolean }>;
    subtitles?: SubtitleTrack[];
  }>('/streaming/resolve', {
    // Cold headless extraction is slow but now bounded server-side (~3.5min
    // worst case). A finite timeout surfaces "no sources" to the user instead
    // of an indefinitely pending request.
    timeout: 240000,
    params: {
      title,
      year,
      type,
      season,
      episode,
      ...(ids?.imdbId ? { imdbId: ids.imdbId } : {}),
      ...(ids?.tmdbId ? { tmdbId: ids.tmdbId } : {}),
    },
  });
  return res.data;
};

export const fetchSubtitles = async (params: {
  imdbId?: string;
  tmdbId?: number;
  title?: string;
  type?: 'movie' | 'series';
  season?: number;
  episode?: number;
}) => {
  const res = await api.get<{
    subtitles: SubtitleTrack[];
  }>('/streaming/subtitles', { params });
  return res.data;
};

export interface MovieBoxEpisode {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
}

export interface MovieBoxSeason {
  seasonNumber: number;
  title: string;
  episodeCount: number;
  episodes: MovieBoxEpisode[];
}

export interface MovieBoxSeriesDetails {
  subjectId: string;
  title: string;
  description: string;
  backdropUrl: string;
  totalSeasons: number;
  totalEpisodes: number;
  seasons: MovieBoxSeason[];
}

export const fetchSeriesMovieBoxSeasonsEpisodes = async (
  title: string,
  year?: number,
  subjectId?: string
) => {
  const res = await api.get<MovieBoxSeriesDetails>('/streaming/series/seasons-episodes', {
    params: { title, year, subjectId },
  });
  return res.data;
};

// --- CineCoins & Subscription APIs ---
export const fetchSubscriptionPlans = async () => {
  const res = await api.get<{
    plans: SubscriptionPlanItem[];
    coinValueINR: number;
    earnRate: { seconds: number; coins: number };
  }>('/users/subscription/plans');
  return res.data;
};

export const purchaseSubscriptionApi = async (planId: string) => {
  const res = await api.post<{
    message: string;
    plan: SubscriptionPlanItem;
    cineCoins: number;
    subscriptionPlan: string | null;
    subscriptionActive: boolean;
    subscriptionExpiresAt: string | null;
  }>('/users/subscription/purchase', { planId });
  return res.data;
};

export const trackWatchTimeApi = async (seconds: number, contentId?: string) => {
  const res = await api.post<{
    earned: number;
    cineCoins: number;
    totalCoinsEarned: number;
    watchTimeCounter: number;
    subscriptionActive: boolean;
    coinsExpiryAt: string | null;
    coinTtlMs: number;
    canEarnCoins: boolean;
  }>('/users/coins/track', { seconds, contentId });
  return res.data;
};

export const fetchUserCoinsApi = async () => {
  const res = await api.get<{
    cineCoins: number;
    totalCoinsEarned: number;
    watchTimeCounter: number;
    coinsExpiryAt: string | null;
    coinTtlMs: number;
    canEarnCoins: boolean;
    subscriptionPlan: string | null;
    subscriptionStartedAt: string | null;
    subscriptionExpiresAt: string | null;
    subscriptionActive: boolean;
    upiId: string | null;
    coinValueINR: number;
    earnRate: { seconds: number; coins: number };
    transactions: CoinTransactionItem[];
    redemptions: RedemptionItem[];
  }>('/users/coins');
  return res.data;
};

export const redeemCoinsApi = async (coins: number, upiId: string) => {
  const res = await api.post<{ message: string; redemption: RedemptionItem; cineCoins: number }>(
    '/users/coins/redeem',
    { coins, upiId }
  );
  return res.data;
};

export const saveUpiIdApi = async (upiId: string) => {
  const res = await api.post<{ message: string; upiId: string }>('/users/coins/upi', { upiId });
  return res.data;
};

// --- Admin redemption APIs ---
export const fetchAdminRedemptionsApi = async (status?: string) => {
  const res = await api.get<{ redemptions: RedemptionItem[] }>('/admin/redemptions', {
    params: status ? { status } : {},
  });
  return res.data;
};

export const approveRedemptionApi = async (id: string, adminNote?: string) => {
  const res = await api.post<{ message: string; redemption: RedemptionItem }>(
    `/admin/redemptions/${id}/approve`,
    { adminNote }
  );
  return res.data;
};

export const rejectRedemptionApi = async (id: string, adminNote?: string) => {
  const res = await api.post<{ message: string; redemption: RedemptionItem }>(
    `/admin/redemptions/${id}/reject`,
    { adminNote }
  );
  return res.data;
};

export const fetchAdminCoinsStatsApi = async () => {
  const res = await api.get<{
    totalCoinsEarned: number;
    totalCoinsRedeemed: number;
    totalPayoutINR: number;
    pendingRedemptions: number;
    activeSubscribers: number;
  }>('/admin/coins/stats');
  return res.data;
};

// ---------- ADMIN: PREMIUM MEMBERSHIP MANAGEMENT ----------

export const fetchAdminSubscribersApi = async (status: 'all' | 'active' | 'expired' | 'cancelled' = 'all', q = '') => {
  const res = await api.get<{
    subscribers: SubscriberItem[];
    stats: { totalRevenueINR: number; totalPurchases: number };
  }>('/admin/subscribers', { params: { status, ...(q ? { q } : {}) } });
  return res.data;
};

export const cancelSubscriptionApi = async (userId: string, note?: string) => {
  const res = await api.post<{ message: string }>(`/admin/subscribers/${userId}/cancel`, { note });
  return res.data;
};

export const extendSubscriptionApi = async (userId: string, days: number) => {
  const res = await api.post<{ message: string }>(`/admin/subscribers/${userId}/extend`, { days });
  return res.data;
};

export const fetchSubscriberPurchasesApi = async (userId: string) => {
  const res = await api.get<{ purchases: SubscriptionPurchaseItem[] }>(`/admin/subscribers/${userId}/purchases`);
  return res.data;
};

// ---------- APP UPDATE & BROADCAST NOTIFICATIONS ----------

export interface AppUpdateItem {
  _id?: string;
  version: string;
  versionCode: number;
  title: string;
  changelog: string;
  downloadUrl: string;
  apkSize: string;
  isMandatory: boolean;
  isActive: boolean;
  usersNotifiedCount: number;
  createdAt: string;
}

export const fetchLatestAppUpdateApi = async () => {
  const res = await api.get<AppUpdateItem>('/app-updates/latest');
  return res.data;
};

export const fetchAdminAppUpdatesApi = async () => {
  const res = await api.get<{ updates: AppUpdateItem[]; totalUsers: number }>('/admin/app-updates');
  return res.data;
};

export const createAdminAppUpdateApi = async (data: {
  version: string;
  versionCode?: number;
  title: string;
  changelog: string;
  downloadUrl?: string;
  apkSize?: string;
  isMandatory?: boolean;
  broadcastNotification?: boolean;
}) => {
  const res = await api.post<{ message: string; update: AppUpdateItem; notifiedCount: number }>(
    '/admin/app-updates',
    data
  );
  return res.data;
};

export const deleteAdminAppUpdateApi = async (id: string) => {
  const res = await api.delete<{ message: string }>(`/admin/app-updates/${id}`);
  return res.data;
};

export const broadcastAdminNotificationApi = async (data: {
  title: string;
  body?: string;
  link?: string;
}) => {
  const res = await api.post<{ message: string; count: number }>(
    '/admin/broadcast-notification',
    data
  );
  return res.data;
};


