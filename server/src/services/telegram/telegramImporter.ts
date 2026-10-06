import { TelegramImport, ITelegramImport } from '../../models/TelegramImport';
import { parseTelegramCaption } from './telegramParser';

export interface RawTelegramMessage {
  channelId: string;
  messageId: string;
  mediaId: string;
  caption: string;
}

export class TelegramImporter {
  /**
   * Process incoming raw Telegram channel posts and queue them for admin review
   */
  async queueTelegramPost(raw: RawTelegramMessage): Promise<ITelegramImport> {
    const existing = await TelegramImport.findOne({ messageId: raw.messageId });
    if (existing) {
      return existing;
    }

    const parsed = parseTelegramCaption(raw.caption);

    const importDoc = new TelegramImport({
      channelId: raw.channelId,
      messageId: raw.messageId,
      mediaId: raw.mediaId,
      originalCaption: raw.caption,
      detectedTitle: parsed.title,
      detectedSeason: parsed.season,
      detectedEpisode: parsed.episode,
      detectedQuality: parsed.quality,
      detectedYear: parsed.year,
      detectedLanguage: parsed.language,
      status: 'PENDING',
    });

    await importDoc.save();
    return importDoc;
  }

  /**
   * Fetch pending import queue for Admin UI
   */
  async getPendingQueue(status?: string) {
    const filter = status ? { status } : {};
    return TelegramImport.find(filter).sort({ createdAt: -1 });
  }
}
