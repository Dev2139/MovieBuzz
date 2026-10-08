import dotenv from 'dotenv';
import { MediaProvider } from './types';
import { MockMediaProvider } from './mockMediaProvider';
import { TelegramMediaProvider } from './telegramClient';

dotenv.config();

class TelegramServiceManager {
  private telegramClient: TelegramMediaProvider;
  private mockProvider: MockMediaProvider;

  constructor() {
    this.telegramClient = new TelegramMediaProvider();
    this.mockProvider = new MockMediaProvider();
  }

  public getProvider(): MediaProvider {
    if (this.telegramClient.isConfigured()) {
      return this.telegramClient;
    }
    return this.mockProvider;
  }

  public getTelegramClient(): TelegramMediaProvider {
    return this.telegramClient;
  }
}

export const storageService = new TelegramServiceManager();

