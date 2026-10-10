import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const MOVIEBOX_SERVICE_URL = process.env.MOVIEBOX_SERVICE_URL || 'http://127.0.0.1:5055';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MovieBoxService {
  private serviceUrl: string;
  private pythonProcess: ChildProcess | null = null;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private isStarting: boolean = false;

  constructor() {
    this.serviceUrl = MOVIEBOX_SERVICE_URL;
    this.ensureServiceRunning();
  }

  private async isServiceHealthy(): Promise<boolean> {
    try {
      const res = await axios.get(`${this.serviceUrl}/health`, { timeout: 2000 });
      return res.status === 200 && res.data?.status === 'ok';
    } catch {
      return false;
    }
  }

  public async ensureServiceRunning(): Promise<boolean> {
    if (await this.isServiceHealthy()) {
      return true;
    }

    if (this.isStarting) return false;
    this.isStarting = true;

    try {
      const scriptPath = path.resolve(__dirname, '../../python/moviebox_service.py');
      console.log(`[MovieBoxService] Starting Python bridge service from ${scriptPath}...`);

      const proc = spawn('python', [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      this.pythonProcess = proc;

      proc.stdout?.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.log(`[MovieBox-Py] ${msg}`);
      });

      proc.stderr?.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.warn(`[MovieBox-Py-Err] ${msg}`);
      });

      proc.on('exit', (code) => {
        console.warn(`[MovieBoxService] Python bridge exited with code ${code}`);
        this.pythonProcess = null;
      });

      // Poll up to 10 seconds for service readiness
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (await this.isServiceHealthy()) {
          console.log(`[MovieBoxService] Python bridge ready at ${this.serviceUrl}`);
          this.isStarting = false;
          return true;
        }
      }
    } catch (err) {
      console.error('[MovieBoxService] Failed to start Python bridge:', err);
    }

    this.isStarting = false;
    return false;
  }

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

  public async search(query: string, type: 'movie' | 'series' | 'all' = 'all') {
    const cacheKey = `search:${type}:${query.toLowerCase().trim()}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    await this.ensureServiceRunning();
    const res = await axios.get(`${this.serviceUrl}/search`, {
      params: { q: query, type },
      timeout: 15000,
    });

    const data = res.data;
    this.setCached(cacheKey, data);
    return data;
  }

  public async getItem(subjectId: string) {
    const cacheKey = `item:${subjectId}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    await this.ensureServiceRunning();
    const res = await axios.get(`${this.serviceUrl}/item`, {
      params: { id: subjectId },
      timeout: 15000,
    });

    const data = res.data;
    this.setCached(cacheKey, data);
    return data;
  }

  public async getSeasons(subjectId: string) {
    const cacheKey = `seasons:${subjectId}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    await this.ensureServiceRunning();
    const res = await axios.get(`${this.serviceUrl}/seasons`, {
      params: { id: subjectId },
      timeout: 15000,
    });

    const data = res.data;
    this.setCached(cacheKey, data);
    return data;
  }

  public async getSources(subjectId: string, season?: number, episode?: number) {
    const cacheKey = `sources:${subjectId}:s${season || 0}:e${episode || 0}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    await this.ensureServiceRunning();
    const params: Record<string, any> = { id: subjectId };
    if (season !== undefined && season > 0) params.se = season;
    if (episode !== undefined && episode > 0) params.ep = episode;

    const res = await axios.get(`${this.serviceUrl}/sources`, {
      params,
      timeout: 20000,
    });

    const data = res.data;
    this.setCached(cacheKey, data);
    return data;
  }

  public async getCaptions(subjectId: string, resourceId: string) {
    const cacheKey = `captions:${subjectId}:${resourceId}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    await this.ensureServiceRunning();
    const res = await axios.get(`${this.serviceUrl}/captions`, {
      params: { id: subjectId, resourceId },
      timeout: 15000,
    });

    const data = res.data;
    this.setCached(cacheKey, data);
    return data;
  }

  /**
   * Helper to resolve sources by title and optional year / type
   */
  public async resolveByTitle(
    title: string,
    year?: number,
    type: 'movie' | 'series' = 'movie',
    season: number = 1,
    episode: number = 1
  ) {
    const cleanTitle = title.replace(/[^\w\s-]/g, '').trim();
    const searchRes = await this.search(cleanTitle, type);
    const results: any[] = searchRes.results || [];
    if (!results.length) {
      return null;
    }

    // Filter results whose titles are relevant to the requested title
    const searchTerms = cleanTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const relevant = results.filter((r) => {
      const rt = (r.title || '').toLowerCase();
      return searchTerms.some((term) => rt.includes(term));
    });

    if (!relevant.length) {
      return null;
    }

    // Attempt to match by release year if provided, otherwise pick best match
    let match = relevant[0];
    if (year) {
      const yearMatch = relevant.find((r) => {
        if (!r.releaseDate) return false;
        return r.releaseDate.startsWith(String(year));
      });
      if (yearMatch) match = yearMatch;
    }

    const subjectId = match.subjectId;
    const sourcesRes = await this.getSources(
      subjectId,
      type === 'series' ? season : undefined,
      type === 'series' ? episode : undefined
    );

    return {
      subject: match,
      sources: sourcesRes.sources || [],
    };
  }
}

export const movieboxService = new MovieBoxService();
