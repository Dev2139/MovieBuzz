import axios from 'axios';
import zlib from 'zlib';
import { tmdbService } from './tmdb/tmdbService';
import { movieboxService } from './movieboxService';

export interface SubtitleOption {
  id: string;
  label: string;
  language: string;
  src: string;
  default?: boolean;
}

const LANGUAGE_CODE_MAP: Record<string, string> = {
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  'brazilian portuguese': 'pt-br',
  hindi: 'hi',
  arabic: 'ar',
  japanese: 'ja',
  chinese: 'zh',
  korean: 'ko',
  russian: 'ru',
  turkish: 'tr',
  dutch: 'nl',
  swedish: 'sv',
  danish: 'da',
  norwegian: 'no',
  finnish: 'fi',
  polish: 'pl',
  greek: 'el',
  czech: 'cs',
  hungarian: 'hu',
  romanian: 'ro',
  albanian: 'sq',
  bengali: 'bn',
  bulgarian: 'bg',
  croatian: 'hr',
  serbian: 'sr',
  indonesian: 'id',
  vietnamese: 'vi',
  thai: 'th',
  hebrew: 'he',
  persian: 'fa',
  farsi: 'fa',
  tamil: 'ta',
  telugu: 'te',
  malayalam: 'ml',
  urdu: 'ur',
};

function normalizeAssTimestamp(t: string): string {
  const [hms, cs] = t.split('.');
  const hmsParts = (hms || '00:00:00').split(':');
  while (hmsParts.length < 3) hmsParts.unshift('0');
  const hh = hmsParts[0].padStart(2, '0');
  const mm = hmsParts[1].padStart(2, '0');
  const ss = hmsParts[2].padStart(2, '0');
  const ms = (cs || '0').padEnd(3, '0').slice(0, 3);
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function assToVtt(assText: string): string {
  const lines = assText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const vttLines: string[] = ['WEBVTT', ''];
  let count = 1;

  for (const line of lines) {
    if (line.startsWith('Dialogue:')) {
      const parts = line.replace(/^Dialogue:\s*/, '').split(',');
      if (parts.length >= 10) {
        let start = parts[1].trim();
        let end = parts[2].trim();
        start = normalizeAssTimestamp(start);
        end = normalizeAssTimestamp(end);

        let text = parts.slice(9).join(',');
        text = text.replace(/\{[^}]+\}/g, '').replace(/\\N/g, '\n').replace(/\\n/g, '\n').trim();

        if (text) {
          vttLines.push(String(count++));
          vttLines.push(`${start} --> ${end}`);
          vttLines.push(text);
          vttLines.push('');
        }
      }
    }
  }
  return vttLines.join('\n');
}

// Convert SubRip (.srt) or ASS to WebVTT (.vtt)
export function srtToVtt(rawText: string): string {
  const trimmed = rawText.trim();
  if (trimmed.startsWith('WEBVTT')) return trimmed;
  if (trimmed.includes('[Events]') || trimmed.includes('Dialogue:')) {
    return assToVtt(trimmed);
  }
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const converted = normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${converted.trim()}`;
}

// Helper: Extract subtitle content (.srt, .vtt, .ass, .ssa) from in-memory ZIP buffer
function extractSubtitleFromZip(buffer: Buffer): string | null {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }
    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);
    const fileName = buffer.toString('utf-8', offset + 30, offset + 30 + fileNameLength);

    const fileDataOffset = offset + 30 + fileNameLength + extraFieldLength;
    const fileData = buffer.subarray(fileDataOffset, fileDataOffset + compressedSize);

    const lower = fileName.toLowerCase();
    if (
      lower.endsWith('.srt') ||
      lower.endsWith('.vtt') ||
      lower.endsWith('.ass') ||
      lower.endsWith('.ssa')
    ) {
      try {
        let content = '';
        if (compression === 0) {
          content = fileData.toString('utf-8');
        } else if (compression === 8) {
          content = zlib.inflateRawSync(fileData).toString('utf-8');
        }
        if (content) {
          return srtToVtt(content);
        }
      } catch (err: any) {
        console.warn('[SubtitleService] ZIP inflation error:', err.message);
      }
    }
    offset = fileDataOffset + compressedSize;
  }
  return null;
}

class SubtitleService {
  private subtitleCache = new Map<string, { subtitles: SubtitleOption[]; timestamp: number }>();
  private vttContentCache = new Map<string, { content: string; timestamp: number }>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  private getCachedSubtitles(key: string): SubtitleOption[] | null {
    const entry = this.subtitleCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.subtitleCache.delete(key);
      return null;
    }
    return entry.subtitles;
  }

  private setCachedSubtitles(key: string, subtitles: SubtitleOption[]) {
    this.subtitleCache.set(key, { subtitles, timestamp: Date.now() });
  }

  private getCachedVtt(key: string): string | null {
    const entry = this.vttContentCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.CACHE_TTL * 24) {
      this.vttContentCache.delete(key);
      return null;
    }
    return entry.content;
  }

  private setCachedVtt(key: string, content: string) {
    this.vttContentCache.set(key, { content, timestamp: Date.now() });
  }

  /**
   * Resolve subtitles for movie or series episode
   */
  public async getSubtitles(params: {
    title?: string;
    imdbId?: string;
    tmdbId?: number;
    type?: 'movie' | 'series';
    season?: number;
    episode?: number;
    baseUrl: string;
  }): Promise<SubtitleOption[]> {
    const { title = '', tmdbId, type = 'movie', season = 1, episode = 1, baseUrl } = params;
    let imdbId = params.imdbId;

    // Resolve imdbId if not provided but tmdbId is available
    if (!imdbId && tmdbId) {
      try {
        const apiKey = process.env.TMDB_API_KEY || '5dbb265bcf35f217cf70ac66d54fd125';
        const extRes = await axios.get(
          `https://api.themoviedb.org/3/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}/external_ids?api_key=${apiKey}`,
          { timeout: 4000 }
        );
        if (extRes.data?.imdb_id) {
          imdbId = extRes.data.imdb_id;
        }
      } catch {}
    }

    // Fallback: Resolve imdbId via TMDB search by title
    if (!imdbId && title) {
      try {
        const enriched = await tmdbService.fetchMetadata(title);
        if (enriched?.imdbId) {
          imdbId = enriched.imdbId;
        }
      } catch {}
    }

    const cacheKey = `${type}:${imdbId || ''}:${tmdbId || ''}:${title.toLowerCase()}:s${season}:e${episode}`;
    const cached = this.getCachedSubtitles(cacheKey);
    if (cached) return cached;

    const subtitles: SubtitleOption[] = [];
    const seenLanguages = new Set<string>();

    if (type === 'series') {
      // 1. Fetch TV Series subtitles from Gestdown
      const gestdownSubs = await this.fetchSeriesGestdown(title, season, episode, baseUrl, tmdbId);
      for (const s of gestdownSubs) {
        if (!seenLanguages.has(s.language)) {
          seenLanguages.add(s.language);
          subtitles.push(s);
        }
      }
    } else {
      // 2. Fetch Movie subtitles from Yify Subtitles
      let movieSubs: SubtitleOption[] = [];
      if (imdbId) {
        movieSubs = await this.fetchMovieYify(imdbId, baseUrl);
      }
      if (!movieSubs.length && title) {
        movieSubs = await this.searchMovieYifyByTitle(title, baseUrl);
      }
      for (const s of movieSubs) {
        if (!seenLanguages.has(s.language)) {
          seenLanguages.add(s.language);
          subtitles.push(s);
        }
      }

      // 3. Complement/fallback with OpenSubtitles REST API
      if (imdbId) {
        const osSubs = await this.fetchOpenSubtitlesRest(imdbId, baseUrl);
        for (const s of osSubs) {
          if (!seenLanguages.has(s.language)) {
            seenLanguages.add(s.language);
            subtitles.push(s);
          }
        }
      }
    }

    // 4. Fallback to OpenSubtitles.com if user configured API key
    if (process.env.OPENSUBTITLES_API_KEY && (imdbId || tmdbId)) {
      try {
        const openSubs = await this.fetchOpenSubtitles(imdbId, tmdbId, type, season, episode, baseUrl);
        for (const s of openSubs) {
          if (!seenLanguages.has(s.language)) {
            seenLanguages.add(s.language);
            subtitles.push(s);
          }
        }
      } catch (err: any) {
        console.warn('[SubtitleService] OpenSubtitles query notice:', err.message);
      }
    }

    // Ensure English is flagged default if available
    const hasEn = subtitles.find((s) => s.language === 'en');
    if (hasEn) {
      subtitles.forEach((s) => {
        s.default = s.language === 'en';
      });
    } else if (subtitles.length > 0) {
      subtitles[0].default = true;
    }

    this.setCachedSubtitles(cacheKey, subtitles);
    return subtitles;
  }

  /**
   * Fetch Yify Subtitles for Movies
   */
  private async fetchMovieYify(imdbId: string, baseUrl: string): Promise<SubtitleOption[]> {
    const cleanImdb = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
    const url = `https://yifysubtitles.ch/movie-imdb/${cleanImdb}`;
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 8000,
      });

      const html: string = res.data || '';
      const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
      const subs: SubtitleOption[] = [];
      const seenLangs = new Set<string>();

      for (const r of rows) {
        const row = r[1];
        const langMatch = row.match(/class="sub-lang">([^<]+)<\/span>/i);
        const linkMatch = row.match(/href="(\/subtitles\/[^"]+)"/i);
        if (!langMatch || !linkMatch) continue;

        const rawLang = langMatch[1].trim();
        const rawLangLower = rawLang.toLowerCase();
        const langCode = LANGUAGE_CODE_MAP[rawLangLower] || rawLangLower.slice(0, 2);
        const subPagePath = linkMatch[1];

        if (seenLangs.has(langCode)) continue;
        seenLangs.add(langCode);

        subs.push({
          id: `yify-${subPagePath.replace('/subtitles/', '')}`,
          label: rawLang,
          language: langCode,
          src: `${baseUrl}/api/streaming/subtitles/file?source=yify&page=${encodeURIComponent(subPagePath)}`,
          default: langCode === 'en',
        });
      }

      return subs;
    } catch (err: any) {
      console.warn('[SubtitleService] Yify subtitle lookup notice:', err.message);
      return [];
    }
  }

  /**
   * Search Yify Subtitles by movie title via /ajax/search/?mov=
   */
  private async searchMovieYifyByTitle(title: string, baseUrl: string): Promise<SubtitleOption[]> {
    try {
      const cleanTitle = title.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
      const res = await axios.get(`https://yifysubtitles.ch/ajax/search/?mov=${encodeURIComponent(cleanTitle)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 6000,
      });

      const list: Array<{ movie: string; imdb: string }> = Array.isArray(res.data) ? res.data : [];
      if (list.length > 0 && list[0].imdb) {
        return this.fetchMovieYify(list[0].imdb, baseUrl);
      }
      return [];
    } catch (err: any) {
      console.warn('[SubtitleService] Yify title search notice:', err.message);
      return [];
    }
  }

  /**
   * Fetch Multi-language Subtitles from OpenSubtitles REST API
   */
  private async fetchOpenSubtitlesRest(imdbId: string, baseUrl: string): Promise<SubtitleOption[]> {
    try {
      const cleanImdb = imdbId.startsWith('tt') ? imdbId.replace('tt', '') : imdbId;
      const url = `https://rest.opensubtitles.org/search/imdbid-${cleanImdb}`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'TemporaryUserAgent' },
        timeout: 7000,
      });

      const list: any[] = Array.isArray(res.data) ? res.data : [];
      const subs: SubtitleOption[] = [];
      const seenLangs = new Set<string>();

      for (const item of list) {
        if (!item.SubDownloadLink) continue;
        const rawLang = item.LanguageName || item.SubLanguageID || 'English';
        const rawLangLower = rawLang.toLowerCase();
        const iso = (item.ISO639 || LANGUAGE_CODE_MAP[rawLangLower] || item.SubLanguageID || 'en').toLowerCase().slice(0, 2);

        if (seenLangs.has(iso)) continue;
        seenLangs.add(iso);

        subs.push({
          id: `os-${item.IDSubtitleFile || item.IDSubtitle}`,
          label: rawLang,
          language: iso,
          src: `${baseUrl}/api/streaming/subtitles/file?source=opensubs_rest&url=${encodeURIComponent(item.SubDownloadLink)}`,
          default: iso === 'en',
        });
      }

      return subs;
    } catch (err: any) {
      console.warn('[SubtitleService] OpenSubtitles REST notice:', err.message);
      return [];
    }
  }

  /**
   * Fetch TV Series subtitles from Gestdown
   */
  private async fetchSeriesGestdown(
    title: string,
    season: number,
    episode: number,
    baseUrl: string,
    tmdbId?: number
  ): Promise<SubtitleOption[]> {
    try {
      const cleanTitle = title.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const searchRes = await axios.get(`https://api.gestdown.info/shows/search/${encodeURIComponent(cleanTitle)}`, {
        timeout: 6000,
      });
      const shows: any[] = searchRes.data?.shows || [];
      if (!shows.length) return [];

      let targetShow = shows[0];
      if (tmdbId) {
        const match = shows.find((s) => s.tmdbId === tmdbId);
        if (match) targetShow = match;
      }

      const languagesToQuery = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese'];
      const results: SubtitleOption[] = [];

      await Promise.all(
        languagesToQuery.map(async (langName) => {
          try {
            const subRes = await axios.get(
              `https://api.gestdown.info/subtitles/get/${targetShow.id}/${season}/${episode}/${langName}`,
              { timeout: 5000 }
            );
            const matching: any[] = subRes.data?.matchingSubtitles || [];
            if (matching.length > 0) {
              const best =
                matching.find((m) => m.completed && m.hd) || matching.find((m) => m.completed) || matching[0];
              const langCode = LANGUAGE_CODE_MAP[langName.toLowerCase()] || langName.toLowerCase().slice(0, 2);
              results.push({
                id: `gestdown-${best.subtitleId}`,
                label: langName,
                language: langCode,
                src: `${baseUrl}/api/streaming/subtitles/file?source=gestdown&id=${best.subtitleId}`,
                default: langCode === 'en',
              });
            }
          } catch {}
        })
      );

      return results;
    } catch (err: any) {
      console.warn('[SubtitleService] Gestdown lookup notice:', err.message);
      return [];
    }
  }

  /**
   * Optional OpenSubtitles.com REST API
   */
  private async fetchOpenSubtitles(
    imdbId?: string,
    tmdbId?: number,
    type: 'movie' | 'series' = 'movie',
    season: number = 1,
    episode: number = 1,
    baseUrl: string = ''
  ): Promise<SubtitleOption[]> {
    const apiKey = process.env.OPENSUBTITLES_API_KEY;
    if (!apiKey) return [];

    const params: Record<string, any> = {
      type: type === 'series' ? 'episode' : 'movie',
    };
    if (imdbId) {
      params.imdb_id = imdbId.replace('tt', '');
    } else if (tmdbId) {
      params.tmdb_id = tmdbId;
    }
    if (type === 'series') {
      params.season_number = season;
      params.episode_number = episode;
    }

    const res = await axios.get('https://api.opensubtitles.com/api/v1/subtitles', {
      params,
      headers: {
        'Api-Key': apiKey,
        'User-Agent': 'MovieBuzz v1.0',
      },
      timeout: 8000,
    });

    const items: any[] = res.data?.data || [];
    const results: SubtitleOption[] = [];
    const seenLangs = new Set<string>();

    for (const item of items) {
      const attr = item.attributes;
      if (!attr || !attr.files || !attr.files.length) continue;
      const lang = (attr.language || 'en').toLowerCase();
      if (seenLangs.has(lang)) continue;
      seenLangs.add(lang);

      const fileId = attr.files[0].file_id;
      results.push({
        id: `opensubs-${item.id}`,
        label: attr.language_name || attr.language || 'English',
        language: lang,
        src: `${baseUrl}/api/streaming/subtitles/file?source=opensubs&fileId=${fileId}`,
        default: lang === 'en',
      });
    }

    return results;
  }

  /**
   * Serve and convert subtitle file to WebVTT
   */
  public async getSubtitleFile(query: {
    source?: string;
    id?: string;
    page?: string;
    fileId?: string;
    url?: string;
  }): Promise<string> {
    const { source, id, page, fileId, url } = query;
    const cacheKey = `vtt:${source}:${id || ''}:${page || ''}:${fileId || ''}:${url || ''}`;
    const cached = this.getCachedVtt(cacheKey);
    if (cached) return cached;

    let vttContent = '';

    if (source === 'gestdown' && id) {
      const res = await axios.get(`https://api.gestdown.info/subtitles/download/${id}`, {
        responseType: 'text',
        timeout: 10000,
      });
      vttContent = srtToVtt(res.data || '');
    } else if (source === 'yify' && page) {
      const pageUrl = `https://yifysubtitles.ch${page}`;
      const pageRes = await axios.get(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 10000,
      });
      const zipMatch = pageRes.data.match(/href="([^"]*\.zip)"/i);
      if (!zipMatch) throw new Error('Zip download link not found on Yify page');

      const zipUrl = `https://yifysubtitles.ch${zipMatch[1]}`;
      const zipRes = await axios.get(zipUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Referer: 'https://yifysubtitles.ch/',
        },
        timeout: 12000,
      });

      const vtt = extractSubtitleFromZip(Buffer.from(zipRes.data));
      if (!vtt) throw new Error('Could not extract subtitle from Yify ZIP archive');
      vttContent = vtt;
    } else if (source === 'opensubs' && fileId && process.env.OPENSUBTITLES_API_KEY) {
      const dlRes = await axios.post(
        'https://api.opensubtitles.com/api/v1/download',
        { file_id: fileId },
        {
          headers: {
            'Api-Key': process.env.OPENSUBTITLES_API_KEY,
            'User-Agent': 'MovieBuzz v1.0',
          },
          timeout: 10000,
        }
      );
      const link = dlRes.data?.link;
      if (!link) throw new Error('OpenSubtitles download link not received');
      const fileRes = await axios.get(link, { responseType: 'text', timeout: 10000 });
      vttContent = srtToVtt(fileRes.data || '');
    } else if (source === 'opensubs_rest' && url) {
      const fileRes = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'TemporaryUserAgent' },
        timeout: 12000,
      });
      let text = '';
      try {
        text = zlib.gunzipSync(Buffer.from(fileRes.data)).toString('utf-8');
      } catch {
        text = Buffer.from(fileRes.data).toString('utf-8');
      }
      vttContent = srtToVtt(text);
    } else if (url) {
      const fileRes = await axios.get(url, { responseType: 'text', timeout: 10000 });
      vttContent = srtToVtt(fileRes.data || '');
    } else {
      throw new Error('Unsupported subtitle source or missing parameters');
    }

    if (!vttContent || !vttContent.trim()) {
      vttContent = 'WEBVTT\n\n';
    }

    this.setCachedVtt(cacheKey, vttContent);
    return vttContent;
  }
}

export const subtitleService = new SubtitleService();
