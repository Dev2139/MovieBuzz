import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { decodeFileId } from 'tg-file-id';
import bigInt from 'big-integer';

dotenv.config();

class TelegramStreamService {
  private client: TelegramClient | null = null;
  private isInitializing = false;
  private initPromise: Promise<TelegramClient | null> | null = null;

  private apiId = Number(process.env.TELEGRAM_API_ID || 39243219);
  private apiHash = process.env.TELEGRAM_API_HASH || '1d2a346250ff0e4861180d9cfff67cb0';
  private botToken = process.env.TELEGRAM_BOT_TOKEN || '8932092666:AAEd0A1Zcc4Bcg_UU83NFUjLV50fc2kQiYY';
  private sessionFilePath = path.join(process.cwd(), '.bot_session');

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
        let savedSession = '';
        if (fs.existsSync(this.sessionFilePath)) {
          savedSession = fs.readFileSync(this.sessionFilePath, 'utf-8').trim();
        }

        console.log('[TelegramStreamService] Connecting MTProto Bot Client...');
        const stringSession = new StringSession(savedSession);
        const client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
          connectionRetries: 5,
        });

        await client.start({ botAuthToken: this.botToken });
        console.log('[TelegramStreamService] MTProto Bot Client connected!');

        const sessionData = (client.session as any).save();
        const newSessionStr = typeof sessionData === 'string' ? sessionData : '';
        if (newSessionStr && newSessionStr.length > 5) {
          fs.writeFileSync(this.sessionFilePath, newSessionStr, 'utf-8');
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
   * Decode Telegram file_id and fetch binary byte chunk directly via MTProto
   * Handles files of ANY size (GBs) with ZERO 20MB limits.
   */
  async getChunk(fileId: string, offset = 0, limit = 512 * 1024): Promise<Buffer | null> {
    try {
      const decoded = decodeFileId(fileId);
      const client = await this.getClient();
      if (!client) return null;

      const sender = await client.getSender(decoded.dcId);

      let inputLocation: any;
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
      return null;
    } catch (err: any) {
      console.warn(`[TelegramStreamService] GetChunk note for fileId ${fileId}:`, err.message);
      return null;
    }
  }
}

export const telegramStreamService = new TelegramStreamService();
