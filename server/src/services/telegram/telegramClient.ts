import dotenv from 'dotenv';
import axios from 'axios';
import { MediaProvider, ContentMediaDescriptor, MediaResource } from './types';
import { MockMediaProvider } from './mockMediaProvider';
import { TelegramImporter } from './telegramImporter';
import { TelegramUserMTProtoClient } from './telegramUserClient';

dotenv.config();

export class TelegramMediaProvider implements MediaProvider {
  private channelId: string;
  private apiId: string;
  private apiHash: string;
  private botToken: string;
  private mockFallback: MockMediaProvider;
  private importer: TelegramImporter;
  private userMtprotoClient: TelegramUserMTProtoClient;

  constructor() {
    this.channelId = process.env.TELEGRAM_CHANNEL_ID || '';
    this.apiId = process.env.TELEGRAM_API_ID || '';
    this.apiHash = process.env.TELEGRAM_API_HASH || '';
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.mockFallback = new MockMediaProvider();
    this.importer = new TelegramImporter();
    this.userMtprotoClient = new TelegramUserMTProtoClient();
  }

  public isConfigured(): boolean {
    return Boolean(this.channelId && (this.apiId || this.botToken || this.channelId.length > 3));
  }

  /**
   * Sync posts directly from Telegram Channel or Bot into MongoDB!
   * Links real Telegram video files and photo covers directly to stream/download endpoints.
   */
  async syncChannelPosts(): Promise<number> {
    if (this.botToken) {
      try {
        console.log(`[TelegramClient] Polling Telegram Bot API for messages sent to @devcinestreambot or channel...`);
        const res = await axios.get(`https://api.telegram.org/bot${this.botToken}/getUpdates`, {
          timeout: 10000,
        });

        if (res.data && res.data.ok && Array.isArray(res.data.result)) {
          let count = 0;
          for (const update of res.data.result) {
            const post = update.channel_post || update.message;
            if (post) {
              const caption = post.caption || post.text || '';
              if (caption.length > 3) {
                let videoFileId = '';
                let photoFileId = '';

                if (post.video) {
                  videoFileId = post.video.file_id;
                  if (post.video.thumbnail) photoFileId = post.video.thumbnail.file_id;
                  else if (post.video.thumb) photoFileId = post.video.thumb.file_id;
                } else if (post.document) {
                  videoFileId = post.document.file_id;
                  if (post.document.thumbnail) photoFileId = post.document.thumbnail.file_id;
                  else if (post.document.thumb) photoFileId = post.document.thumb.file_id;
                }

                if (post.photo && post.photo.length > 0) {
                  photoFileId = post.photo[post.photo.length - 1].file_id;
                }

                const baseUrl = process.env.VERCEL_URL 
                  ? `https://${process.env.VERCEL_URL}` 
                  : (process.env.BACKEND_URL || 'http://localhost:5000');

                const streamUrl = videoFileId ? `${baseUrl}/api/media/proxy-file/${videoFileId}` : undefined;
                const downloadUrl = videoFileId ? `${baseUrl}/api/media/download-file/${videoFileId}` : undefined;
                const posterUrl = photoFileId ? `${baseUrl}/api/media/proxy-file/${photoFileId}` : undefined;

                const published = await this.importer.autoPublishTelegramPost({
                  channelId: String(post.chat?.id || this.channelId),
                  messageId: String(post.message_id),
                  mediaId: videoFileId || `tg_media_${post.message_id}`,
                  caption,
                  streamUrl,
                  downloadUrl,
                  posterUrl,
                });
                if (published) {
                  count++;
                }
              }
            }
          }

          if (count > 0) {
            console.log(`[TelegramClient] Processed & published ${count} real Telegram media posts to catalog!`);
            return count;
          }
        }
      } catch (err: any) {
        console.warn(`[TelegramClient] Bot API notice: ${err.message}`);
      }
    }

    // MTProto User API Fallback
    if (this.apiId && this.apiHash) {
      const userCount = await this.userMtprotoClient.fetchPrivateChannelPosts();
      if (userCount > 0) return userCount;
    }

    return 0;
  }

  async getContent(): Promise<ContentMediaDescriptor[]> {
    return [];
  }

  async getMedia(mediaId: string): Promise<MediaResource | null> {
    return this.mockFallback.getMedia(mediaId);
  }

  async getStreamUrl(mediaId: string): Promise<string> {
    return this.mockFallback.getStreamUrl(mediaId);
  }

  async getDownloadUrl(mediaId: string): Promise<string> {
    return this.mockFallback.getDownloadUrl(mediaId);
  }
}
