import dotenv from 'dotenv';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { TelegramImporter } from './telegramImporter';

dotenv.config();

export class TelegramUserMTProtoClient {
  private apiId: number;
  private apiHash: string;
  private channelId: string;
  private sessionString: string;
  private client: TelegramClient | null = null;
  private importer: TelegramImporter;

  private sessionInvalid: boolean = false;

  constructor() {
    this.apiId = Number(process.env.TELEGRAM_API_ID || 0);
    this.apiHash = process.env.TELEGRAM_API_HASH || '';
    this.channelId = process.env.TELEGRAM_CHANNEL_ID || '';
    this.sessionString = process.env.TELEGRAM_SESSION_STRING || '';
    this.importer = new TelegramImporter();
  }

  public isConfigured(): boolean {
    return Boolean(!this.sessionInvalid && this.apiId && this.apiHash && this.channelId && this.sessionString);
  }

  /**
   * Connect to Telegram MTProto User API using your API_ID, API_HASH, and session string.
   */
  async fetchPrivateChannelPosts(): Promise<number> {
    if (!this.isConfigured()) {
      return 0;
    }

    try {
      console.log(`[TelegramUserClient] Connecting MTProto User API for Channel: ${this.channelId}...`);
      const stringSession = new StringSession(this.sessionString);

      this.client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
        connectionRetries: 1,
      });

      await this.client.connect();
      const peerId = this.channelId.startsWith('-100') ? BigInt(this.channelId) : this.channelId;

      const messages = await this.client.getMessages(peerId as any, { limit: 20 });

      let count = 0;
      for (const msg of messages) {
        if (msg.message && msg.message.length > 5) {
          await this.importer.autoPublishTelegramPost({
            channelId: this.channelId,
            messageId: String(msg.id),
            mediaId: `tg_mtproto_${msg.id}`,
            caption: msg.message,
          });
          count++;
        }
      }

      console.log(`[TelegramUserClient] Processed ${count} channel posts!`);
      return count;
    } catch (error: any) {
      if (error.message?.includes('AUTH_KEY_DUPLICATED') || error.message?.includes('406')) {
        console.warn(`[TelegramUserClient] MTProto Session string is duplicated/invalid (${error.message}). Disabling MTProto fallback.`);
        this.sessionInvalid = true;
      } else {
        console.warn(`[TelegramUserClient] MTProto note (${error.message}).`);
      }
      return 0;
    } finally {
      if (this.client) {
        await this.client.disconnect().catch(() => {});
        this.client = null;
      }
    }
  }
}
