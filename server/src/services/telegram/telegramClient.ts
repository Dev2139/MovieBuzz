import { MediaProvider, ContentMediaDescriptor, MediaResource } from './types';
import { MockMediaProvider } from './mockMediaProvider';

export class TelegramMediaProvider implements MediaProvider {
  private channelId: string;
  private apiId: string;
  private apiHash: string;
  private mockFallback: MockMediaProvider;

  constructor() {
    this.channelId = process.env.TELEGRAM_CHANNEL_ID || '';
    this.apiId = process.env.TELEGRAM_API_ID || '';
    this.apiHash = process.env.TELEGRAM_API_HASH || '';
    this.mockFallback = new MockMediaProvider();
  }

  public isConfigured(): boolean {
    return Boolean(this.channelId && this.apiId && this.apiHash);
  }

  async getContent(): Promise<ContentMediaDescriptor[]> {
    if (!this.isConfigured()) {
      console.log('[TelegramMediaProvider] Telegram credentials not set. Using MockMediaProvider fallback.');
      return this.mockFallback.getContent();
    }
    // Production Telegram API MTProto connection logic goes here when configured
    return this.mockFallback.getContent();
  }

  async getMedia(mediaId: string): Promise<MediaResource | null> {
    if (!this.isConfigured()) {
      return this.mockFallback.getMedia(mediaId);
    }
    return this.mockFallback.getMedia(mediaId);
  }

  async getStreamUrl(mediaId: string): Promise<string> {
    if (!this.isConfigured()) {
      return this.mockFallback.getStreamUrl(mediaId);
    }
    return this.mockFallback.getStreamUrl(mediaId);
  }

  async getDownloadUrl(mediaId: string): Promise<string> {
    if (!this.isConfigured()) {
      return this.mockFallback.getDownloadUrl(mediaId);
    }
    return this.mockFallback.getDownloadUrl(mediaId);
  }
}
