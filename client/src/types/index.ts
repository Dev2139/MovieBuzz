export interface Content {
  _id: string;
  title: string;
  slug: string;
  type: 'movie' | 'series';
  description: string;
  posterUrl: string;
  backdropUrl: string;
  trailerUrl?: string;
  releaseYear: number;
  genres: string[];
  languages: string[];
  cast: string[];
  director?: string;
  rating: number;
  popularity: number;
  featured: boolean;
  status: 'published' | 'draft';
  tmdbId?: number;
  imdbId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Season {
  _id: string;
  seriesId: string;
  seasonNumber: number;
  title: string;
  description?: string;
  posterUrl?: string;
  releaseYear: number;
}

export interface Episode {
  _id: string;
  seriesId: string;
  seasonId: string;
  seasonNumber?: number;
  episodeNumber: number;
  title: string;
  description?: string;
  thumbnailUrl: string;
  duration: number;
  releaseDate?: string;
  rating?: number;
}

export interface Media {
  _id: string;
  contentId?: string;
  episodeId?: string;
  quality: '1080p' | '720p' | '480p' | '4K';
  resolution: string;
  fileSize: string;
  duration: number;
  mimeType: string;
  provider: 'mock' | 'telegram' | 's3' | 'r2' | 'bunny';
  providerMediaId: string;
  providerMessageId?: string;
  streamUrl: string;
  downloadUrl: string;
  status: 'active' | 'processing' | 'archived';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  favorites?: string[];
  watchlist?: string[];
}

export interface WatchHistoryItem {
  _id: string;
  userId?: string;
  contentId: Content;
  episodeId?: Episode;
  progress: number;
  duration: number;
  completed: boolean;
  lastWatchedAt: string;
}

export interface LocalPlaybackState {
  contentId: string;
  episodeId?: string;
  contentSlug: string;
  contentType: 'movie' | 'series';
  seriesSlug?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  title: string;
  posterUrl: string;
  position: number;
  duration: number;
  percentage: number;
  updatedAt: string;
}

export interface TelegramImportItem {
  _id: string;
  channelId: string;
  messageId: string;
  mediaId: string;
  originalCaption: string;
  detectedTitle: string;
  detectedSeason?: number;
  detectedEpisode?: number;
  detectedEpisodeEnd?: number;
  detectedQuality?: string;
  detectedYear?: number;
  detectedLanguage?: string;
  status: 'PENDING' | 'REVIEWED' | 'IMPORTED' | 'IGNORED' | 'ERROR';
  mappedContentId?: string;
  mappedEpisodeId?: string;
  createdAt: string;
}

export interface AdminStats {
  totalMovies: number;
  totalSeries: number;
  totalEpisodes: number;
  totalUsers: number;
  totalViews: number;
  totalDownloads: number;
  pendingImports: number;
  pendingRequests?: number;
}

export interface ContentRequest {
  _id: string;
  title: string;
  type: 'movie' | 'series';
  releaseYear?: number;
  notes?: string;
  requestedBy?: string;
  userName?: string;
  userEmail?: string;
  status: 'pending' | 'fulfilled' | 'rejected';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCatalogResponse {
  items: Content[];
  total: number;
  totalMovies: number;
  totalSeries: number;
  totalDrafts: number;
  page: number;
  totalPages: number;
}
