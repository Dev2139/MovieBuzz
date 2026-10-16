/**
 * Native MovieBox Provider
 * -----------------------------------------------------------------------------
 * Ported directly from mesamirh/MovieBox-TUI (Rust).
 * Implements native MovieBox mobile BFF protocol with HMAC-MD5 signing, host pool
 * failover, session management, DASH manifest extraction from signCookie,
 * and community resource resolution with deprecation notice filtering.
 */

import crypto from 'crypto';
import axios from 'axios';

const HOST_POOL = [
  'https://api6.aoneroom.com',
  'https://api5.aoneroom.com',
  'https://api4.aoneroom.com',
  'https://api4sg.aoneroom.com',
  'https://api3.aoneroom.com',
  'https://api6sg.aoneroom.com',
  'https://api.inmoviebox.com',
];

export const STREAM_REFERER = 'https://sportslive.wine';

// MovieBox HMAC-MD5 secret key from MovieBox-TUI
const SECRET_BYTES = Buffer.from([
  0xef, 0xa8, 0x91, 0x97, 0x4e, 0xec, 0xd3, 0x14, 0x8d, 0xf6, 0x3a, 0xa6,
  0x11, 0x60, 0x2d, 0xef, 0xd1, 0x01, 0x25, 0x9b, 0xa5, 0x21, 0x02, 0x2c,
  0x57, 0xae, 0x05, 0x66, 0xbd, 0x8e,
]);

export interface MovieBoxStreamSource {
  url: string;
  quality: string;
  resolution: string;
  format: 'DASH' | 'MP4' | 'HLS';
  mimeType: string;
  codecName?: string;
  fileSize?: string;
  signCookie?: string;
  referer: string;
  resourceId?: string;
  isOriginal?: boolean;
}

export class NativeMovieBoxService {
  private activeToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private hostIdx: number = 0;

  private userAgent =
    'com.community.oneroom/50020119 (Linux; U; Android 11; en_US; Redmi; Build/RP1A.200720.011; Cronet/135.0.7012.3)';

  private clientInfo = JSON.stringify({
    package_name: 'com.community.oneroom',
    version_name: '4.0.01.0813.03',
    version_code: 50020119,
    os: 'android',
    os_version: '11',
    install_ch: 'ps',
    device_id: 'a1b2c3d4e5f67890123456789abcdef0',
    install_store: 'ps',
    gaid: '11112222-3333-4444-5555-666677778888',
    brand: 'Redmi',
    model: '2201117TY',
    system_language: 'en',
    net: 'NETWORK_WIFI',
    region: 'US',
    timezone: 'Asia/Kolkata',
    sp_code: '40401',
    'X-Play-Mode': '2',
  });

  private generateClientToken(ts: number): string {
    const tsStr = String(ts);
    const reversed = tsStr.split('').reverse().join('');
    const hash = crypto.createHash('md5').update(reversed).digest('hex');
    return `${tsStr},${hash}`;
  }

  private sortedQueryString(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      const params = [...parsed.searchParams.entries()];
      if (params.length === 0) return '';
      params.sort((a, b) => a[0].localeCompare(b[0]));
      return params.map(([k, v]) => `${k}=${v}`).join('&');
    } catch {
      return '';
    }
  }

  private generateSignature(
    method: string,
    accept: string,
    contentType: string,
    urlStr: string,
    body: string | null,
    ts: number
  ): string {
    let canonicalUrl = urlStr;
    try {
      const parsed = new URL(urlStr);
      const query = this.sortedQueryString(urlStr);
      canonicalUrl = query ? `${parsed.pathname}?${query}` : parsed.pathname;
    } catch {}

    let bodyHash = '';
    let bodyLength = '';
    if (body) {
      const buf = Buffer.from(body);
      bodyLength = String(buf.length);
      const truncated = buf.length > 102400 ? buf.subarray(0, 102400) : buf;
      bodyHash = crypto.createHash('md5').update(truncated).digest('hex');
    }

    const canonical = [
      method.toUpperCase(),
      accept || '',
      contentType || '',
      bodyLength,
      String(ts),
      bodyHash,
      canonicalUrl,
    ].join('\n');

    const hmac = crypto.createHmac('md5', SECRET_BYTES);
    hmac.update(canonical);
    const sigB64 = hmac.digest('base64');
    return `${ts}|2|${sigB64}`;
  }

  public async request<T = any>(method: string, path: string, bodyData: any = null): Promise<T> {
    const bodyStr = bodyData ? (typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData)) : null;

    // Ensure session token (unless requesting visitor-login)
    let token = this.activeToken;
    if (!token && !path.includes('visitor-login')) {
      token = await this.ensureSession();
    }

    const hostCount = HOST_POOL.length;
    let lastError: any = null;

    for (let i = 0; i < hostCount; i++) {
      const currentHost = HOST_POOL[(this.hostIdx + i) % hostCount];
      const fullUrl = `${currentHost}${path}`;
      const ts = Date.now();
      const accept = 'application/json';
      const contentType = 'application/json';
      const clientToken = this.generateClientToken(ts);
      const signature = this.generateSignature(method, accept, contentType, fullUrl, bodyStr, ts);

      const headers: Record<string, string> = {
        'User-Agent': this.userAgent,
        'Accept': accept,
        'Content-Type': contentType,
        'Connection': 'keep-alive',
        'x-client-token': clientToken,
        'x-tr-signature': signature,
        'x-client-info': this.clientInfo,
        'x-client-status': '0',
        'x-forwarded-for': '103.241.12.34',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const res = await axios({
          method,
          url: fullUrl,
          headers,
          data: bodyStr || undefined,
          timeout: 9000,
          validateStatus: (s) => s < 500,
        });

        if (res.status === 200 && res.data) {
          this.hostIdx = (this.hostIdx + i) % hostCount;
          return res.data;
        }

        // If unauthorized or token expired, invalidate token and retry once
        if (res.status === 401 || res.status === 403) {
          this.activeToken = null;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw new Error(`MovieBox hosts exhausted: ${lastError?.message || 'unknown error'}`);
  }

  public async ensureSession(): Promise<string> {
    if (this.activeToken && Date.now() < this.tokenExpiresAt) {
      return this.activeToken;
    }

    const res = await this.request('POST', '/wefeed-mobile-bff/user-api/visitor-login', '{}');
    const token = res?.data?.token || res?.token;
    if (!token) {
      throw new Error('Failed to obtain visitor token from MovieBox');
    }
    this.activeToken = token;
    // Token valid for 6 hours
    this.tokenExpiresAt = Date.now() + 6 * 3600 * 1000;
    return token;
  }

  public isDeprecationNoticeUrl(url?: string): boolean {
    if (!url) return true;
    const lower = url.toLowerCase();
    return (
      lower.includes('b164fbfb4347792950bdfbfb563d39d9') ||
      lower.includes('1c7de0bd3393702d9191801f15f88f8d') ||
      lower.includes('9a0461bc39da389663bf3dbb17091d3f') ||
      lower.includes('/notice.mp4') ||
      (lower.includes('macdn.aoneroom.com') && lower.includes('/other/'))
    );
  }

  /**
   * Decodes urlprefix or CloudFront-Policy from sign_cookie.
   * As in MovieBox-TUI (fb6b1e4), only /dash/ manifests are accepted.
   */
  public resolveDashManifestFromPolicy(signCookie?: string): string | null {
    if (!signCookie) return null;
    const decodeB64Padded = (s: string) => {
      let padding = (4 - (s.length % 4)) % 4;
      if (padding > 0) s += '='.repeat(padding);
      try {
        return Buffer.from(s, 'base64').toString('utf-8');
      } catch {
        return null;
      }
    };

    for (const part of signCookie.split(';')) {
      const trimmed = part.trim();
      if (trimmed.includes('urlprefix=')) {
        const idx = trimmed.indexOf('urlprefix=');
        const prefixPart = trimmed.slice(idx + 'urlprefix='.length);
        const b64Token = prefixPart.split(':')[0].trim();
        const normalized = b64Token.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = decodeB64Padded(normalized);
        if (decoded && decoded.includes('/dash/')) {
          const base = decoded.replace(/\*+$/, '').replace(/\/+$/, '');
          return `${base}/index.mpd`;
        }
      }
      if (trimmed.startsWith('CloudFront-Policy=')) {
        const policyRaw = trimmed.slice('CloudFront-Policy='.length).trim();
        const normalized = policyRaw.replace(/-/g, '+').replace(/_/g, '=').replace(/~/g, '/');
        const decoded = decodeB64Padded(normalized);
        if (decoded) {
          try {
            const js = JSON.parse(decoded);
            const res = js.Statement?.[0]?.Resource || '';
            if (res.includes('/dash/')) {
              const base = res.replace(/\*+$/, '').replace(/\/+$/, '');
              return `${base}/index.mpd`;
            }
          } catch {}
        }
      }
    }
    return null;
  }

  /**
   * Search MovieBox catalog by title/keyword
   */
  public async search(title: string): Promise<any[]> {
    try {
      const res = await this.request('POST', '/wefeed-mobile-bff/subject-api/search/v2', {
        keyword: title,
        page: 1,
        perPage: 15,
        subjectType: 0,
      });
      return res?.data?.results?.[0]?.subjects || res?.data?.list || [];
    } catch {
      return [];
    }
  }

  /**
   * Resolve streams for a movie or series episode using MovieBox protocol
   */
  public async resolveStreams(options: {
    title: string;
    year?: number;
    type?: 'movie' | 'series';
    season?: number;
    episode?: number;
    subjectId?: string;
  }): Promise<MovieBoxStreamSource[]> {
    const { title, year, type = 'movie', season = 1, episode = 1 } = options;
    let targetSubjectId = options.subjectId;

    if (!targetSubjectId) {
      const subjects = await this.search(title);
      if (subjects.length === 0) return [];

      // Match subject by title and year if provided
      const cleanTarget = title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = subjects.find((s: any) => {
        const sTitle = (s.title || s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const sYear = s.releaseDate ? parseInt(s.releaseDate.slice(0, 4), 10) : undefined;
        if (year && sYear && Math.abs(sYear - year) > 1) return false;
        return sTitle.includes(cleanTarget) || cleanTarget.includes(sTitle);
      }) || subjects[0];

      targetSubjectId = match.subjectId || match.id;
    }

    if (!targetSubjectId) return [];

    const isSeries = type === 'series';
    const sNum = isSeries ? season : 0;
    const epNum = isSeries ? episode : 0;

    const playInfoPath =
      sNum === 0 && epNum === 0
        ? `/wefeed-mobile-bff/subject-api/play-info/v2?subjectId=${targetSubjectId}`
        : `/wefeed-mobile-bff/subject-api/play-info/v2?subjectId=${targetSubjectId}&season=${sNum}&episode=${epNum}`;

    const resourcePath =
      sNum === 0 && epNum === 0
        ? `/wefeed-mobile-bff/subject-api/resource?subjectId=${targetSubjectId}&page=1&perPage=20`
        : `/wefeed-mobile-bff/subject-api/resource?subjectId=${targetSubjectId}&se=${sNum}&ep=${epNum}&page=1&perPage=20`;

    const [playInfoRes, resourceRes] = await Promise.all([
      this.request('GET', playInfoPath).catch(() => null),
      this.request('GET', resourcePath).catch(() => null),
    ]);

    const sources: MovieBoxStreamSource[] = [];
    const seenUrls = new Set<string>();

    // 1. Check streams from play-info (DASH / direct)
    const streams = playInfoRes?.data?.streams || [];
    for (const s of streams) {
      const signCookie = s.signCookie || '';
      const streamUrl = s.url || '';
      const manifestUrl = this.resolveDashManifestFromPolicy(signCookie);

      const playableUrl = manifestUrl || (!this.isDeprecationNoticeUrl(streamUrl) && streamUrl.startsWith('http') ? streamUrl : null);
      if (!playableUrl || seenUrls.has(playableUrl)) continue;
      seenUrls.add(playableUrl);

      const isDash = playableUrl.includes('/dash/') || playableUrl.endsWith('.mpd');
      const isHls = playableUrl.includes('.m3u8') || playableUrl.includes('/hls/');

      sources.push({
        url: playableUrl,
        quality: s.resolutions ? `${s.resolutions.split(',')[0]}p • MovieBox` : 'HD • MovieBox',
        resolution: s.resolutions ? `${s.resolutions.split(',')[0]}p` : 'Auto',
        format: isDash ? 'DASH' : isHls ? 'HLS' : 'MP4',
        mimeType: isDash ? 'application/dash+xml' : isHls ? 'application/vnd.apple.mpegurl' : 'video/mp4',
        codecName: s.codecName || 'h264',
        fileSize: s.size ? `${(parseInt(s.size, 10) / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Standard',
        signCookie,
        referer: STREAM_REFERER,
        resourceId: String(s.id || targetSubjectId),
        isOriginal: true,
      });
    }

    // 2. Check community resources
    const resources = resourceRes?.data?.list || [];
    for (const r of resources) {
      const link = r.resourceLink || r.url;
      if (!link || !link.startsWith('http') || this.isDeprecationNoticeUrl(link)) continue;
      if (seenUrls.has(link)) continue;
      seenUrls.add(link);

      const resLabel = r.resolution ? `${r.resolution}p` : 'HD';
      const isDash = link.includes('/dash/') || link.endsWith('.mpd');
      const isHls = link.includes('.m3u8') || link.includes('/hls/');

      sources.push({
        url: link,
        quality: `${resLabel} • MovieBox Community`,
        resolution: resLabel,
        format: isDash ? 'DASH' : isHls ? 'HLS' : 'MP4',
        mimeType: isDash ? 'application/dash+xml' : isHls ? 'application/vnd.apple.mpegurl' : 'video/mp4',
        codecName: r.codecName || 'h264',
        fileSize: r.size ? `${(parseInt(r.size, 10) / (1024 * 1024 * 1024)).toFixed(2)} GB` : undefined,
        referer: STREAM_REFERER,
        resourceId: String(r.id || r.resourceId || targetSubjectId),
        isOriginal: true,
      });
    }

    return sources;
  }
}

export const nativeMovieBoxService = new NativeMovieBoxService();
