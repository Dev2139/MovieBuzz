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
  async refreshLocations(): Promise<void> {
    try {
      const client = await this.getClient();
      if (!client) return;

      const peer = await client.getEntity(this.channelId).catch(() => null);
      if (!peer) return;

      const messages = await client.getMessages(peer as any, { limit: 50 });
      const now = Date.now();

      for (const msg of messages) {
        if (msg.media && (msg.media as any).document) {
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
        await this.refreshLocations();
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
  async getChunk(fileId: string, offset = 0, limit = 512 * 1024): Promise<Buffer | null> {
    try {
      const client = await this.getClient();
      if (!client) return null;

      const decoded = decodeFileId(fileId);
      const docIdStr = String(decoded.id);

      // Check if location is in cache
      let cached = this.locationCache.get(docIdStr);
      if (!cached || Date.now() - cached.updatedAt > 1800000) {
        await this.refreshLocations();
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

      const sender = await client.getSender(dcId);

      try {
        const res: any = await sender.send(
          new Api.upload.GetFile({
            location: inputLocation,
            offset: bigInt(offset) as any,
            limit,
          })
        );

        if (res && res.bytes) {
          return Buffer.from(res.bytes);
        }
      } catch (fileRefErr: any) {
        if (fileRefErr.message?.includes('FILE_REFERENCE_EXPIRED') || fileRefErr.code === 400) {
          console.log(`[TelegramStreamService] File reference expired for ${fileId}, refreshing from Telegram...`);
          this.locationCache.delete(docIdStr);
          await this.refreshLocations();

          const freshCached = this.locationCache.get(docIdStr);
          if (freshCached) {
            const freshSender = await client.getSender(freshCached.dcId);
            const resRetry: any = await freshSender.send(
              new Api.upload.GetFile({
                location: freshCached.inputLocation,
                offset: bigInt(offset) as any,
                limit,
              })
            );
            if (resRetry && resRetry.bytes) {
              return Buffer.from(resRetry.bytes);
            }
          }
        }
        throw fileRefErr;
      }

      return null;
    } catch (err: any) {
      console.warn(`[TelegramStreamService] GetChunk note for fileId ${fileId}:`, err.message);
      return null;
    }
  }
}

export const telegramStreamService = new TelegramStreamService();
