import { LocalPlaybackState } from '../types';

const PLAYBACK_KEY = 'cinestream_playback_history';
const WATCHLIST_KEY = 'cinestream_watchlist';
const FAVORITES_KEY = 'cinestream_favorites';

export const getLocalPlaybackHistory = (): LocalPlaybackState[] => {
  try {
    const raw = localStorage.getItem(PLAYBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalPlaybackPosition = (item: Omit<LocalPlaybackState, 'updatedAt' | 'percentage'>): void => {
  try {
    const history = getLocalPlaybackHistory();
    const percentage = item.duration > 0 ? Math.round((item.position / item.duration) * 1000) / 10 : 0;

    const newItem: LocalPlaybackState = {
      ...item,
      percentage,
      updatedAt: new Date().toISOString(),
    };

    // Find and replace existing item by contentId & episodeId
    const index = history.findIndex((h) => h.contentId === item.contentId && h.episodeId === item.episodeId);

    if (index > -1) {
      history[index] = newItem;
    } else {
      history.unshift(newItem);
    }

    // Keep top 30 recent items
    const trimmed = history.slice(0, 30);
    localStorage.setItem(PLAYBACK_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save local playback position', error);
  }
};

export const getLocalPlaybackItem = (contentId: string, episodeId?: string): LocalPlaybackState | null => {
  const history = getLocalPlaybackHistory();
  return history.find((h) => h.contentId === contentId && (!episodeId || h.episodeId === episodeId)) || null;
};

export const clearLocalPlaybackHistory = (): void => {
  localStorage.removeItem(PLAYBACK_KEY);
};

// --- Anonymous Watchlist ---
export const getLocalWatchlist = (): string[] => {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const toggleLocalWatchlist = (contentId: string): boolean => {
  const list = getLocalWatchlist();
  const index = list.indexOf(contentId);
  let isAdded = false;

  if (index > -1) {
    list.splice(index, 1);
  } else {
    list.push(contentId);
    isAdded = true;
  }

  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  return isAdded;
};

// --- Anonymous Favorites ---
export const getLocalFavorites = (): string[] => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const toggleLocalFavorites = (contentId: string): boolean => {
  const list = getLocalFavorites();
  const index = list.indexOf(contentId);
  let isAdded = false;

  if (index > -1) {
    list.splice(index, 1);
  } else {
    list.push(contentId);
    isAdded = true;
  }

  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  return isAdded;
};
