import dotenv from 'dotenv';
import { MediaProvider } from './types';
import { MockMediaProvider } from './mockMediaProvider';
import { TelegramMediaProvider } from './telegramClient';

dotenv.config();

class TelegramServiceManager {
  private activeProvider: MediaProvider;
  private telegramClient: TelegramMediaProvider;

  constructor() {
    this.telegramClient = new TelegramMediaProvider();
    if (this.telegramClient.isConfigured()) {
      console.log(`[StorageService] Initialized with TelegramMediaProvider for Channel: ${process.env.TELEGRAM_CHANNEL_ID}`);
      this.activeProvider = this.telegramClient;
    } else {
      console.log('[StorageService] Initialized with MockMediaProvider');
      this.activeProvider = new MockMediaProvider();
    }
  }

  public getProvider(): MediaProvider {
    return this.activeProvider;
  }

  public getTelegramClient(): TelegramMediaProvider {
    return this.telegramClient;
  }
}

export const storageService = new TelegramServiceManager();
