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

class TelegramStreamService {
  private client: TelegramClient | null = null;
  private isInitializing = false;
  private initPromise: Promise<TelegramClient | null> | null = null;

  private apiId = Number(process.env.TELEGRAM_API_ID || 39243219);
  private apiHash = process.env.TELEGRAM_API_HASH || '1d2a346250ff0e4861180d9cfff67cb0';
  private botToken = process.env.TELEGRAM_BOT_TOKEN || '8932092666:AAEd0A1Zcc4Bcg_UU83NFUjLV50fc2kQiYY';
  private channelId = process.env.TELEGRAM_CHANNEL_ID || '@devcinestreambot';
  private sessionFilePath = path.join(process.cwd(), '.bot_session');

  // Map of documentId string -> CachedLocation with fresh fileReference & size
  private locationCache = new Map<string, CachedLocation>();

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
        let savedSession = process.env.TELEGRAM_SESSION_STRING || '';
        if (!savedSession && fs.existsSync(this.sessionFilePath)) {
          savedSession = fs.readFileSync(this.sessionFilePath, 'utf-8').trim();
        }

        console.log('[TelegramStreamService] Connecting MTProto Client...');
        const stringSession = new StringSession(savedSession);
        const client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
          connectionRetries: 5,
        });

        if (savedSession && savedSession.length > 5) {
          await client.connect();
          console.log('[TelegramStreamService] MTProto Client connected via User Session!');
        } else {
          await client.start({ botAuthToken: this.botToken });
          console.log('[TelegramStreamService] MTProto Bot Client connected!');

          const sessionData = (client.session as any).save();
          const newSessionStr = typeof sessionData === 'string' ? sessionData : '';
          if (newSessionStr && newSessionStr.length > 5) {
            fs.writeFileSync(this.sessionFilePath, newSessionStr, 'utf-8');
          }
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
              this.locationCache.set(docId, {
                dcId: doc.dcId,
                size: docSize,
                updatedAt: now,
                inputLocation: new Api.InputDocumentFileLocation({
                  id: doc.id,
                  accessHash: doc.accessHash,
                  fileReference: doc.fileReference,
                  thumbSize: '',
                }),
              });
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
            this.locationCache.set(docId, {
              dcId: doc.dcId,
              size: docSize,
              updatedAt: now,
              inputLocation: new Api.InputDocumentFileLocation({
                id: doc.id,
                accessHash: doc.accessHash,
                fileReference: doc.fileReference,
                thumbSize: '',
              }),
            });
          }
        }
      }

      console.log(`[TelegramStreamService] Refreshed ${this.locationCache.size} media file references from Telegram!`);
    } catch (err: any) {
      console.warn('[TelegramStreamService] refreshLocations note:', err.message);
    }
  }

  /**
   * Get total file size in bytes for a fileId
   */
  async getFileSize(fileId: string): Promise<number> {
    try {
      const decoded = decodeFileId(fileId);
      const docIdStr = String(decoded.id);
      let cached = this.locationCache.get(docIdStr);
      if (!cached) {
        await this.refreshLocations(docIdStr);
        cached = this.locationCache.get(docIdStr);
      }
      return cached ? cached.size : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Decode Telegram file_id and fetch binary byte chunk directly via MTProto
   * Handles files of ANY size (GBs) with ZERO 20MB limits.
   */
  async getChunk(fileId: string, offset = 0, limit = 512 * 1024, messageId?: string): Promise<Buffer | null> {
    try {
      const client = await this.getClient();
      if (!client) return null;

      // 1. Enforce Telegram MTProto API alignment constraints:
      // - limit must be <= 1 MB (1048576 bytes) and a multiple of 4096 bytes
      // - offset must be a multiple of limit (offset % limit === 0)
      let safeLimit = Math.min(limit, 1024 * 1024);
      safeLimit = Math.max(4096, Math.floor(safeLimit / 4096) * 4096);
      const safeOffset = Math.max(0, Math.floor(offset / safeLimit) * safeLimit);

      const decoded = decodeFileId(fileId);
      const docIdStr = String(decoded.id);

      // Check if location is in cache
      let cached = this.locationCache.get(docIdStr);
      if (!cached || Date.now() - cached.updatedAt > 1800000) {
        await this.refreshLocations(docIdStr, messageId);
        cached = this.locationCache.get(docIdStr);
      }

      let inputLocation: any;
      let dcId: number;

      if (cached) {
        inputLocation = cached.inputLocation;
        dcId = cached.dcId;
      } else {
        dcId = decoded.dcId;
        if (decoded.fileType === 'photo' || decoded.fileType === 'thumbnail') {
          inputLocation = new Api.InputPhotoFileLocation({
            id: bigInt(decoded.id) as any,
            accessHash: bigInt(decoded.access_hash) as any,
            fileReference: Buffer.from(decoded.fileReference, 'hex'),
            thumbSize: 'm',
          });
        } else {
          inputLocation = new Api.InputDocumentFileLocation({
            id: bigInt(decoded.id) as any,
            accessHash: bigInt(decoded.access_hash) as any,
            fileReference: Buffer.from(decoded.fileReference, 'hex'),
            thumbSize: '',
          });
        }
      }

      // Retry loop to handle expired file references or transient MTProto drops
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const request = new Api.upload.GetFile({
            location: inputLocation,
            offset: bigInt(safeOffset) as any,
            limit: safeLimit,
          });

          // Try sending to target DC sender connection first, fallback to main client invoke
          let res: any;
          try {
            const sender = await client.getSender(dcId);
            res = await sender.send(request);
          } catch {
            res = await client.invoke(request);
          }

          if (res && res.bytes) {
            return Buffer.from(res.bytes);
          }
        } catch (fileRefErr: any) {
          console.warn(`[TelegramStreamService] GetChunk attempt ${attempt} notice:`, fileRefErr.message);

          if (
            fileRefErr.message?.includes('FILE_REFERENCE') ||
            fileRefErr.message?.includes('LOCATION_INVALID') ||
            fileRefErr.code === 400
          ) {
            console.log(`[TelegramStreamService] Refreshing file reference for ${fileId}...`);
            this.locationCache.delete(docIdStr);
            await this.refreshLocations(docIdStr, messageId);

            const freshCached = this.locationCache.get(docIdStr);
            if (freshCached) {
              inputLocation = freshCached.inputLocation;
              dcId = freshCached.dcId;
              continue;
            }
          }

          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 400 * attempt));
          }
        }
      }

      return null;
    } catch (err: any) {
      console.warn(`[TelegramStreamService] GetChunk note for fileId ${fileId}:`, err.message);
      return null;
    }
  }
}

export const telegramStreamService = new TelegramStreamService();

