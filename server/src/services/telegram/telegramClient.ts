import dotenv from 'dotenv';
import axios from 'axios';
import { MediaProvider, ContentMediaDescriptor, MediaResource } from './types';
import { MockMediaProvider } from './mockMediaProvider';
import { TelegramImporter } from './telegramImporter';
import { TelegramUserMTProtoClient } from './telegramUserClient';
import { telegramStreamService } from './telegramStreamService';

dotenv.config();

export class TelegramMediaProvider implements MediaProvider {
  private mockFallback: MockMediaProvider;
  private importer: TelegramImporter;
  private userMtprotoClient: TelegramUserMTProtoClient;

  private lastUpdateId: number = 0;

  constructor() {
    this.mockFallback = new MockMediaProvider();
    this.importer = new TelegramImporter();
    this.userMtprotoClient = new TelegramUserMTProtoClient();
  }

  private get channelId(): string {
    return process.env.TELEGRAM_CHANNEL_ID || '';
  }

  private get apiId(): string {
    return process.env.TELEGRAM_API_ID || '';
  }

  private get apiHash(): string {
    return process.env.TELEGRAM_API_HASH || '';
  }

  private get botToken(): string {
    return process.env.TELEGRAM_BOT_TOKEN || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.channelId && (this.apiId || this.botToken || this.channelId.length > 3));
  }

  /**
   * Sync posts directly from Telegram Channel or Bot into MongoDB!
   * Links real Telegram video files and photo covers directly to stream/download endpoints.
   */
  async syncChannelPosts(): Promise<number> {
    let count = 0;

    if (this.botToken) {
      try {
        console.log(`[TelegramClient] Polling Telegram Bot API for messages sent to @devcinestreambot or channel...`);
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates${this.lastUpdateId ? `?offset=${this.lastUpdateId + 1}` : ''}`;
        const res = await axios.get(url, {
          timeout: 10000,
        });

        if (res.data && res.data.ok && Array.isArray(res.data.result)) {
          for (const update of res.data.result) {
            if (update.update_id && update.update_id > this.lastUpdateId) {
              this.lastUpdateId = update.update_id;
            }
            const post = update.channel_post || update.message;
            if (post) {
              let caption = post.caption || post.text || '';
              if (!caption) {
                if (post.video && post.video.file_name) caption = post.video.file_name;
                else if (post.document && post.document.file_name) caption = post.document.file_name;
              }

              if (caption.length >= 2 || post.video || post.document) {
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

                const streamUrl = videoFileId ? `${baseUrl}/api/media/proxy-file/${encodeURIComponent(videoFileId)}` : undefined;
                const downloadUrl = videoFileId ? `${baseUrl}/api/media/download-file/${encodeURIComponent(videoFileId)}` : undefined;
                const posterUrl = photoFileId ? `${baseUrl}/api/media/proxy-file/${encodeURIComponent(photoFileId)}` : undefined;

                const published = await this.importer.autoPublishTelegramPost({
                  channelId: String(post.chat?.id || this.channelId),
                  messageId: String(post.message_id),
                  mediaId: videoFileId || `tg_media_${post.message_id}`,
                  caption: caption || `Telegram Post ${post.message_id}`,
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
        }
      } catch (err: any) {
        if (err.response?.status === 409) {
          // Another server instance (e.g. Render/production) is polling getUpdates. Suppress 409 notice.
        } else {
          console.warn(`[TelegramClient] Bot API notice: ${err.message}`);
        }
      }
    }

    // MTProto User API Fallback
    if (this.apiId && this.apiHash) {
      try {
        const userCount = await this.userMtprotoClient.fetchPrivateChannelPosts();
        if (userCount > 0) count += userCount;
      } catch (err: any) {
        console.warn(`[TelegramClient] MTProto user client sync notice: ${err.message}`);
      }

      try {
        const mtClient = await telegramStreamService.getClient();
        if (mtClient && this.channelId) {
          const peer = await mtClient.getEntity(this.channelId).catch(() => null);
          if (peer) {
            let messages: any[] = [];
            try {
              messages = await mtClient.getMessages(peer as any, { limit: 100 });
            } catch (getMsgErr: any) {
              // Bots cannot use messages.GetHistory via MTProto — skip silently
              if (!getMsgErr.message?.includes('BOT_METHOD_INVALID')) {
                console.warn(`[TelegramClient] MTProto getMessages notice: ${getMsgErr.message}`);
              }
            }

            const baseUrl = process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : (process.env.BACKEND_URL || 'http://localhost:5000');

            for (const msg of messages) {
              if (msg && (msg.message || msg.media)) {
                const caption = msg.message || '';
                if (caption.length > 2) {
                  let videoFileId = '';
                  if (msg.media && (msg.media as any).document) {
                    videoFileId = (msg.media as any).document.id.toString();
                  }

                  const streamUrl = videoFileId ? `${baseUrl}/api/media/proxy-file/${encodeURIComponent(videoFileId)}` : undefined;
                  const downloadUrl = videoFileId ? `${baseUrl}/api/media/download-file/${encodeURIComponent(videoFileId)}` : undefined;

                  const published = await this.importer.autoPublishTelegramPost({
                    channelId: this.channelId,
                    messageId: String(msg.id),
                    mediaId: videoFileId || `tg_media_${msg.id}`,
                    caption,
                    streamUrl,
                    downloadUrl,
                  });
                  if (published) {
                    count++;
                  }
                }
              }
            }
          }
        }
      } catch (mtErr: any) {
        if (!mtErr.message?.includes('BOT_METHOD_INVALID')) {
          console.warn(`[TelegramClient] MTProto channel sync notice: ${mtErr.message}`);
        }
      }
    }

    if (count > 0) {
      console.log(`[TelegramClient] Processed & published ${count} real Telegram media posts to catalog!`);
    }

    return count;
  }

  /**
   * Handle real-time Webhook payload sent directly by Telegram Bot API when new posts arrive!
   */
  async handleWebhookUpdate(update: any): Promise<boolean> {
    const post = update?.channel_post || update?.message;
    if (!post) return false;

    let caption = post.caption || post.text || '';
    if (!caption) {
      if (post.video && post.video.file_name) caption = post.video.file_name;
      else if (post.document && post.document.file_name) caption = post.document.file_name;
    }

    if (caption.length >= 2 || post.video || post.document) {
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
        caption: caption || `Telegram Post ${post.message_id}`,
        streamUrl,
        downloadUrl,
        posterUrl,
      });

      return Boolean(published);
    }
    return false;
  }

  async getContent(): Promise<ContentMediaDescriptor[]> {
    return [];
  }

  async getMedia(mediaId: string): Promise<MediaResource | null> {
    return this.mockFallback.getMedia(mediaId);
  }

  async getStreamUrl(mediaId: string): Promise<string> {
    if (this.botToken && mediaId && mediaId.length > 10 && !mediaId.includes('http')) {
      try {
        const res = await axios.get(`https://api.telegram.org/bot${this.botToken}/getFile?file_id=${encodeURIComponent(mediaId)}`, { timeout: 8000 });
        if (res.data && res.data.ok && res.data.result && res.data.result.file_path) {
          return `https://api.telegram.org/file/bot${this.botToken}/${res.data.result.file_path}`;
        }
      } catch (err: any) {
        console.warn(`[TelegramClient] getStreamUrl Bot API notice: ${err.message}`);
      }
    }
    return this.mockFallback.getStreamUrl(mediaId);
  }

  async getDownloadUrl(mediaId: string): Promise<string> {
    return this.mockFallback.getDownloadUrl(mediaId);
  }
}

