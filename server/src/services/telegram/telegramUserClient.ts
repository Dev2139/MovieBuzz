import dotenv from 'dotenv';
import { TelegramImporter } from './telegramImporter';
import { telegramStreamService } from './telegramStreamService';

dotenv.config();

export class TelegramUserMTProtoClient {
  private importer: TelegramImporter;
  private sessionInvalid: boolean = false;

  constructor() {
    this.importer = new TelegramImporter();
  }

  private get apiId(): number {
    return Number(process.env.TELEGRAM_API_ID || 0);
  }

  private get apiHash(): string {
    return process.env.TELEGRAM_API_HASH || '';
  }

  private get channelId(): string {
    return process.env.TELEGRAM_CHANNEL_ID || '';
  }

  private get sessionString(): string {
    return process.env.TELEGRAM_SESSION_STRING || '';
  }

  public isConfigured(): boolean {
    return Boolean(!this.sessionInvalid && this.apiId && this.apiHash && this.channelId && this.sessionString);
  }

  /**
   * Connect to Telegram MTProto User API using shared telegramStreamService client instance.
   * NOTE: This only works with a real USER session string, not a bot token.
   * Bots cannot use messages.GetHistory — skip silently if running as bot.
   */
  async fetchPrivateChannelPosts(): Promise<number> {
    if (!this.isConfigured()) {
      return 0;
    }

    try {
      const client = await telegramStreamService.getClient();
      if (!client) return 0;

      const peerId = this.channelId.startsWith('-100') ? BigInt(this.channelId) : this.channelId;
      const messages = await client.getMessages(peerId as any, { limit: 20 });

      let count = 0;
      for (const msg of messages) {
        if (msg && msg.message && msg.message.length > 5) {
          await this.importer.autoPublishTelegramPost({
            channelId: this.channelId,
            messageId: String(msg.id),
            mediaId: `tg_mtproto_${msg.id}`,
            caption: msg.message,
          });
          count++;
        }
      }

      return count;
    } catch (error: any) {
      if (error.message?.includes('AUTH_KEY_DUPLICATED') || error.message?.includes('406')) {
        console.warn(`[TelegramUserClient] MTProto Session string notice (${error.message}).`);
        this.sessionInvalid = true;
      } else if (
        error.message?.includes('BOT_METHOD_INVALID') ||
        error.message?.includes('400')
      ) {
        // Bot tokens cannot call messages.GetHistory — skip silently, this is expected
      } else {
        console.warn(`[TelegramUserClient] MTProto note (${error.message}).`);
      }
      return 0;
    }
  }
}
