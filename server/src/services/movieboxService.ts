/**
 * MovieBox Service (Native TypeScript Implementation)
 * ---------------------------------------------------
 * Replaced legacy Python bridge with nativeMovieBoxService ported directly
 * from mesamirh/MovieBox-TUI. Pure TypeScript, zero Python process dependencies.
 */

import { nativeMovieBoxService } from './nativeMovieboxService';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MovieBoxService {
  private cache: Map<string, CacheEntry<any>> = new Map();

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCached<T>(key: string, data: T) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  public async ensureServiceRunning(): Promise<boolean> {
    return true;
  }

  public async search(query: string, type: 'movie' | 'series' | 'all' = 'all') {
    const cacheKey = `search:${type}:${query.toLowerCase().trim()}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const results = await nativeMovieBoxService.search(query, type);
    const data = { results };
    this.setCached(cacheKey, data);
    return data;
  }

  public async getItem(subjectId: string) {
    const cacheKey = `item:${subjectId}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const data = await nativeMovieBoxService.getItem(subjectId);
    this.setCached(cacheKey, data);
    return data;
  }

  public async getSeasons(subjectId: string) {
    const cacheKey = `seasons:${subjectId}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const data = await nativeMovieBoxService.getSeasons(subjectId);
    this.setCached(cacheKey, data);
    return data;
  }

  public async getSources(subjectId: string, season?: number, episode?: number) {
    const cacheKey = `sources:${subjectId}:s${season || 0}:e${episode || 0}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const data = await nativeMovieBoxService.getSources(subjectId, season, episode);
    this.setCached(cacheKey, data);
    return data;
  }

  public async getCaptions(subjectId: string, resourceId: string) {
    return [];
  }

  public async resolveByTitle(
    title: string,
    year?: number,
    type: 'movie' | 'series' = 'movie',
    season: number = 1,
    episode: number = 1
  ) {
    const sources = await nativeMovieBoxService.resolveStreams({
      title,
      year,
      type,
      season,
      episode,
    });
    return {
      subject: null,
      sources,
      dubs: [],
    };
  }
}

export const movieboxService = new MovieBoxService();
