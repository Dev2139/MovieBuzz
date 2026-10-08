import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { decodeFileId } from 'tg-file-id';
import bigInt from 'big-integer';

dotenv.config();

interface CachedLocation {
  inputLocation: any;
  dcId: number;
  size: number;
  updatedAt: number;
}

interface CachedChunk {
  buffer: Buffer;
  expiresAt: number;
}

class TelegramStreamService {
  private client: TelegramClient | null = null;
  private isInitializing = false;
  private initPromise: Promise<TelegramClient | null> | null = null;

  private sessionFilePath = path.join(process.cwd(), '.bot_session');

  private get apiId(): number {
    return Number(process.env.TELEGRAM_API_ID || 0);
  }

  private get apiHash(): string {
    return process.env.TELEGRAM_API_HASH || '';
  }

  private get botToken(): string {
    return process.env.TELEGRAM_BOT_TOKEN || '';
  }

  private get channelId(): string {
    return process.env.TELEGRAM_CHANNEL_ID || '';
  }

  // Map of documentId string -> CachedLocation with fresh fileReference & size
  private locationCache = new Map<string, CachedLocation>();
  // RAM cache for recent 512KB video byte chunks
  private chunkMemoryCache = new Map<string, CachedChunk>();

  private getCachedChunk(key: string): Buffer | null {
    const item = this.chunkMemoryCache.get(key);
    if (item && Date.now() < item.expiresAt) {
      return item.buffer;
    }
    if (item) this.chunkMemoryCache.delete(key);
    return null;
  }

  private setCachedChunk(key: string, buffer: Buffer): void {
    if (this.chunkMemoryCache.size > 150) {
      const oldestKey = this.chunkMemoryCache.keys().next().value;
      if (oldestKey) this.chunkMemoryCache.delete(oldestKey);
    }
    this.chunkMemoryCache.set(key, { buffer, expiresAt: Date.now() + 60000 });
  }

  async getClient(): Promise<TelegramClient | null> {
    if (this.client && this.client.connected) {
      return this.client;
    }
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const apiId = this.apiId;
        const apiHash = this.apiHash;

        if (!apiId || !apiHash) {
          console.warn('[TelegramStreamService] MTProto note: TELEGRAM_API_ID or TELEGRAM_API_HASH is not set in environment.');
          return null;
        }

        let savedSession = process.env.TELEGRAM_SESSION_STRING || '';
        if (!savedSession && fs.existsSync(this.sessionFilePath)) {
          savedSession = fs.readFileSync(this.sessionFilePath, 'utf-8').trim();
        }

        console.log('[TelegramStreamService] Connecting MTProto Client...');
        const stringSession = new StringSession(savedSession);
        const client = new TelegramClient(stringSession, apiId, apiHash, {
          connectionRetries: 5,
          autoReconnect: true,
          useWSS: false,
        });

        // Disable GramJS update loop polling to prevent background TIMEOUT exceptions
        (client as any)._updateLoop = () => Promise.resolve();

        if (this.botToken) {
          try {
            await client.start({ botAuthToken: this.botToken });
            console.log('[TelegramStreamService] MTProto Bot Client connected successfully!');
          } catch (botErr: any) {
            console.warn('[TelegramStreamService] Bot auth fallback notice:', botErr.message);
            if (savedSession && savedSession.length > 5) {
              await client.connect();
              console.log('[TelegramStreamService] MTProto Client connected via User Session!');
            } else {
              throw botErr;
            }
          }
        } else if (savedSession && savedSession.length > 5) {
          await client.connect();
          console.log('[TelegramStreamService] MTProto Client connected via User Session!');
        } else {
          console.warn('[TelegramStreamService] MTProto note: No valid session or bot token provided.');
          return null;
        }

        this.client = client;
        return client;
      } catch (err: any) {
        console.warn('[TelegramStreamService] MTProto note:', err.message);
        return null;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Fetch recent chat/channel messages to refresh fileReferences & sizes for all videos
   */
  async refreshLocations(targetDocId?: string, messageId?: string): Promise<void> {
    try {
      const client = await this.getClient();
      if (!client) return;

      const peer = await client.getEntity(this.channelId).catch(() => null);
      if (!peer) return;

      const now = Date.now();

      // If specific messageId is provided, fetch that exact message first
      if (messageId) {
        try {
          const directMsgs = await client.getMessages(peer as any, { ids: [Number(messageId)] });
          for (const msg of directMsgs) {
            if (msg && msg.media && (msg.media as any).document) {
              const doc = (msg.media as any).document;
              const docId = doc.id.toString();
              const docSize = doc.size ? (doc.size.toNumber ? doc.size.toNumber() : Number(doc.size)) : 0;
              const locData: CachedLocation = {
                dcId: doc.dcId,
                size: docSize,
                updatedAt: now,
                inputLocation: new Api.InputDocumentFileLocation({
                  id: doc.id,
                  accessHash: doc.accessHash,
                  fileReference: doc.fileReference,
                  thumbSize: '',
                }),
              };
              this.locationCache.set(docId, locData);
              if (targetDocId) this.locationCache.set(targetDocId, locData);
            }
          }
        } catch {
          // ignore error and fallback to fetching recent channel messages
        }
      }

      // Fetch channel messages if targetDocId is not cached yet
      if (!targetDocId || !this.locationCache.has(targetDocId)) {
        const messages = await client.getMessages(peer as any, { limit: 100 });
        for (const msg of messages) {
          if (msg && msg.media && (msg.media as any).document) {
            const doc = (msg.media as any).document;
            const docId = doc.id.toString();
            const docSize = doc.size ? (doc.size.toNumber ? doc.size.toNumber() : Number(doc.size)) : 0;
            const locData: CachedLocation = {
              dcId: doc.dcId,
              size: docSize,
              updatedAt: now,
              inputLocation: new Api.InputDocumentFileLocation({
                id: doc.id,
                accessHash: doc.accessHash,
                fileReference: doc.fileReference,
                thumbSize: '',
              }),
            };
            this.locationCache.set(docId, locData);
            if (msg.id && targetDocId && targetDocId.includes(String(msg.id))) {
              this.locationCache.set(targetDocId, locData);
            }
          }
        }
      }

      console.log(`[TelegramStreamService] Refreshed ${this.locationCache.size} media file references from Telegram!`);
    } catch (err: any) {
      console.warn('[TelegramStreamService] refreshLocations note:', err.message);
    }
  }

  /**
   * Get total file size in bytes for a fileId instantly
   */
  async getFileSize(fileId: string, messageId?: string): Promise<number> {
    try {
      let docIdStr = fileId;
      try {
        const decoded = decodeFileId(fileId);
        if (decoded && decoded.id) docIdStr = String(decoded.id);
      } catch {}

      let cached = this.locationCache.get(docIdStr) || this.locationCache.get(fileId);
      if (!cached) {
        await this.refreshLocations(fileId, messageId);
        cached = this.locationCache.get(docIdStr) || this.locationCache.get(fileId);
      }
      return cached?.size || 1500000000;
    } catch {
      return 1500000000;
    }
  }

  /**
   * Internal worker to fetch byte chunk directly from MTProto
   */
  private async fetchAndCacheChunk(
    fileId: string,
    safeOffset: number,
    safeLimit: number,
    messageId?: string
  ): Promise<Buffer | null> {
    const cacheKey = `${fileId}:${safeOffset}:${safeLimit}`;
    const existing = this.getCachedChunk(cacheKey);
    if (existing) return existing;

    try {
      const client = await this.getClient();
      if (!client) return null;

      let decoded: any = null;
      let docIdStr = fileId;
      try {
        decoded = decodeFileId(fileId);
        if (decoded && decoded.id) docIdStr = String(decoded.id);
      } catch {}

      let cached = this.locationCache.get(docIdStr) || this.locationCache.get(fileId);
      if (!cached && !decoded) {
        await this.refreshLocations(fileId, messageId);
        cached = this.locationCache.get(docIdStr) || this.locationCache.get(fileId);
      }

      let inputLocation: any;
      let dcId: number;

      if (cached) {
        inputLocation = cached.inputLocation;
        dcId = cached.dcId;
      } else if (decoded) {
        dcId = decoded.dcId || 4;
        const fileRefBuffer = decoded.fileReference
          ? (Buffer.isBuffer(decoded.fileReference)
              ? decoded.fileReference
              : Buffer.from(decoded.fileReference, 'hex'))
          : Buffer.alloc(0);

        if (decoded.fileType === 'photo' || decoded.fileType === 'thumbnail') {
          inputLocation = new Api.InputPhotoFileLocation({
            id: bigInt(decoded.id) as any,
            accessHash: bigInt(decoded.access_hash) as any,
            fileReference: fileRefBuffer,
            thumbSize: 'm',
          });
        } else {
          inputLocation = new Api.InputDocumentFileLocation({
            id: bigInt(decoded.id) as any,
            accessHash: bigInt(decoded.access_hash) as any,
            fileReference: fileRefBuffer,
            thumbSize: '',
          });
        }
      } else {
        return null;
      }

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const request = new Api.upload.GetFile({
            location: inputLocation,
            offset: bigInt(safeOffset) as any,
            limit: safeLimit,
          });

          let res: any;
          try {
            res = await client.invoke(request);
          } catch (invokeErr: any) {
            if (
              invokeErr?.message?.includes('AUTH_KEY_DUPLICATED') ||
              invokeErr?.message?.includes('406') ||
              invokeErr?.message?.includes('DISCONNECT')
            ) {
              console.warn('[TelegramStreamService] MTProto socket reset triggered for reconnect...');
              this.client = null;
              this.initPromise = null;
            }
            try {
              const sender = await client.getSender(dcId);
              res = await sender.send(request);
            } catch {
              throw invokeErr;
            }
          }

          if (res && res.bytes) {
            const buf = Buffer.from(res.bytes);
            this.setCachedChunk(cacheKey, buf);
            return buf;
          }
        } catch (fileRefErr: any) {
          if (
            fileRefErr.message?.includes('FILE_REFERENCE') ||
            fileRefErr.message?.includes('LOCATION_INVALID') ||
            fileRefErr.code === 400
          ) {
            this.locationCache.delete(docIdStr);
            this.locationCache.delete(fileId);
            await this.refreshLocations(fileId, messageId);

            const freshCached = this.locationCache.get(docIdStr) || this.locationCache.get(fileId);
            if (freshCached) {
              inputLocation = freshCached.inputLocation;
              dcId = freshCached.dcId;
              continue;
            }
          }

          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 200 * attempt));
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Decode Telegram file_id and fetch binary byte chunk directly via MTProto
   * Zero network latency pre-fetching & RAM caching for instant video startup
   */
  async getChunk(fileId: string, offset = 0, limit = 512 * 1024, messageId?: string): Promise<Buffer | null> {
    try {
      let safeLimit = Math.min(limit, 1024 * 1024);
      safeLimit = Math.max(4096, Math.floor(safeLimit / 4096) * 4096);
      const safeOffset = Math.max(0, Math.floor(offset / safeLimit) * safeLimit);

      const cacheKey = `${fileId}:${safeOffset}:${safeLimit}`;
      const cachedBuf = this.getCachedChunk(cacheKey);

      // Pre-fetch next chunk asynchronously in RAM background
      const nextOffset = safeOffset + safeLimit;
      const nextCacheKey = `${fileId}:${nextOffset}:${safeLimit}`;
      if (!this.getCachedChunk(nextCacheKey)) {
        this.fetchAndCacheChunk(fileId, nextOffset, safeLimit, messageId).catch(() => {});
      }

      if (cachedBuf) {
        return cachedBuf;
      }

      return await this.fetchAndCacheChunk(fileId, safeOffset, safeLimit, messageId);
    } catch (err: any) {
      console.warn(`[TelegramStreamService] GetChunk note for fileId ${fileId}:`, err.message);
      return null;
    }
  }
}

export const telegramStreamService = new TelegramStreamService();

