import { TelegramImport, ITelegramImport } from '../../models/TelegramImport';
import { Content } from '../../models/Content';
import { Season } from '../../models/Season';
import { Episode } from '../../models/Episode';
import { Media } from '../../models/Media';
import { parseTelegramCaption } from './telegramParser';

export interface RawTelegramMessage {
  channelId: string;
  messageId: string;
  mediaId: string;
  caption: string;
  streamUrl?: string;
  downloadUrl?: string;
  fileSize?: string;
  posterUrl?: string;
  backdropUrl?: string;
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
   * Auto-Publish Telegram channel post directly into the website catalog!
   * No manual typing or admin action required — channel posts directly become website movies/episodes.
   */
  async autoPublishTelegramPost(raw: RawTelegramMessage) {
    const parsed = parseTelegramCaption(raw.caption);
    const title = parsed.title;
    const year = parsed.year || 2026;
    const quality = parsed.quality || '1080p';
    const language = parsed.language || 'English';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const defaultPoster = raw.posterUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800';
    const defaultBackdrop = raw.backdropUrl || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600';
    const defaultStream = raw.streamUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const defaultDownload = raw.downloadUrl || defaultStream;

    // Check if it's a TV Series episode (e.g., S01E02)
    if (parsed.season || parsed.episode) {
      let series = await Content.findOne({ title, type: 'series' });
      if (!series) {
        series = new Content({
          title,
          slug: `${slug}-${year}`,
          type: 'series',
          description: raw.caption,
          posterUrl: defaultPoster,
          backdropUrl: defaultBackdrop,
          releaseYear: year,
          genres: ['Action', 'Drama', 'Sci-Fi'],
          languages: [language],
          rating: 8.5,
          status: 'published',
        });
        await series.save();
      }

      const seasonNum = parsed.season || 1;
      const episodeNum = parsed.episode || 1;

      let season = await Season.findOne({ seriesId: series._id, seasonNumber: seasonNum });
      if (!season) {
        season = new Season({
          seriesId: series._id,
          seasonNumber: seasonNum,
          title: `Season ${seasonNum}`,
          releaseYear: year,
        });
        await season.save();
      }

      let episodeDoc = await Episode.findOne({ seasonId: season._id, episodeNumber: episodeNum });
      if (!episodeDoc) {
        episodeDoc = new Episode({
          seriesId: series._id,
          seasonId: season._id,
          episodeNumber: episodeNum,
          title: `Episode ${episodeNum}`,
          description: raw.caption,
          thumbnailUrl: defaultPoster,
          duration: 2700,
        });
        await episodeDoc.save();
      }

      const media = new Media({
        episodeId: episodeDoc._id,
        quality: quality as any,
        resolution: quality === '4K' ? '3840x2160' : '1920x1080',
        fileSize: raw.fileSize || '1.2 GB',
        streamUrl: defaultStream,
        downloadUrl: defaultDownload,
        provider: 'telegram',
        providerMediaId: raw.mediaId,
        providerMessageId: raw.messageId,
        status: 'active',
      });
      await media.save();

      return { type: 'series', series, season, episode: episodeDoc, media };
    } else {
      // Movie Post
      let movie = await Content.findOne({ title, type: 'movie' });
      if (!movie) {
        movie = new Content({
          title,
          slug: `${slug}-${year}`,
          type: 'movie',
          description: raw.caption,
          posterUrl: defaultPoster,
          backdropUrl: defaultBackdrop,
          releaseYear: year,
          genres: ['Action', 'Sci-Fi', 'Thriller'],
          languages: [language],
          rating: 8.4,
          status: 'published',
        });
        await movie.save();
      }

      const media = new Media({
        contentId: movie._id,
        quality: quality as any,
        resolution: quality === '4K' ? '3840x2160' : '1920x1080',
        fileSize: raw.fileSize || '1.4 GB',
        streamUrl: defaultStream,
        downloadUrl: defaultDownload,
        provider: 'telegram',
        providerMediaId: raw.mediaId,
        providerMessageId: raw.messageId,
        status: 'active',
      });
      await media.save();

      return { type: 'movie', movie, media };
    }
  }

  /**
   * Fetch pending import queue for Admin UI
   */
  async getPendingQueue(status?: string) {
    const filter = status ? { status } : {};
    return TelegramImport.find(filter).sort({ createdAt: -1 });
  }
}
