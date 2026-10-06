import { MediaProvider } from './types';
import { MockMediaProvider } from './mockMediaProvider';
import { TelegramMediaProvider } from './telegramClient';

class TelegramServiceManager {
  private activeProvider: MediaProvider;

  constructor() {
    const telegramProvider = new TelegramMediaProvider();
    if (telegramProvider.isConfigured()) {
      console.log('[StorageService] Initialized with TelegramMediaProvider');
      this.activeProvider = telegramProvider;
    } else {
      console.log('[StorageService] Initialized with MockMediaProvider');
      this.activeProvider = new MockMediaProvider();
    }
  }

  public getProvider(): MediaProvider {
    return this.activeProvider;
  }
}

export const storageService = new TelegramServiceManager();
