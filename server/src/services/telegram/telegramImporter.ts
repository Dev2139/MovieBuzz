import { TelegramImport, ITelegramImport } from '../../models/TelegramImport';
import { Content } from '../../models/Content';
import { Season } from '../../models/Season';
import { Episode } from '../../models/Episode';
import { Media } from '../../models/Media';
import { parseTelegramCaption } from './telegramParser';
import { tmdbService } from '../tmdb/tmdbService';

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
   * Automatically enriches with TMDB/IMDb ratings, posters, backdrops & plot summaries.
   */
  async autoPublishTelegramPost(raw: RawTelegramMessage) {
    try {
      const parsed = parseTelegramCaption(raw.caption);
      const title = parsed.title;
      if (!title || title.startsWith('/') || title.toLowerCase() === 'start' || title.length < 2) {
        return null;
      }
      const year = parsed.year || 2026;
      const quality = parsed.quality || '1080p';
      const language = parsed.language || 'English';
      const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // Fetch TMDB / OMDb Real Metadata & Ratings
      const tmdbMeta = await tmdbService.fetchMetadata(title, year, parsed.season || parsed.episode ? 'series' : 'movie').catch(() => null);

      const defaultPoster = tmdbMeta?.posterUrl || raw.posterUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800';
      const defaultBackdrop = tmdbMeta?.backdropUrl || raw.backdropUrl || defaultPoster;
      const description = tmdbMeta?.description || raw.caption;
      const rating = tmdbMeta?.rating || 8.5;
      const genres = tmdbMeta?.genres || (parsed.genres && parsed.genres.length > 0 ? parsed.genres : ['Action', 'Drama']);
      const cast = tmdbMeta?.cast || (parsed.cast && parsed.cast.length > 0 ? parsed.cast : ['Popular Cast']);
      const languages = tmdbMeta?.languages || [language];
      const releaseYear = tmdbMeta?.releaseYear || year;
      const defaultStream = raw.streamUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      const defaultDownload = raw.downloadUrl || defaultStream;

      // Check if it's a TV Series episode (e.g., S01E02)
      if (parsed.season || parsed.episode) {
        let series = await Content.findOne({ $or: [{ title }, { slug: `${baseSlug}-${releaseYear}` }], type: 'series' });
        if (!series) {
          try {
            series = new Content({
              title: tmdbMeta?.title || title,
              slug: `${baseSlug}-${releaseYear}`,
              type: 'series',
              description,
              posterUrl: defaultPoster,
              backdropUrl: defaultBackdrop,
              releaseYear,
              genres,
              languages,
              cast,
              rating,
              status: 'published',
            });
            await series.save();
          } catch {
            series = await Content.findOne({ title, type: 'series' });
          }
        }

        if (!series) return null;

        const seasonNum = parsed.season || 1;
        const episodeNum = parsed.episode || 1;

        let season = await Season.findOne({ seriesId: series._id, seasonNumber: seasonNum });
        if (!season) {
          season = new Season({
            seriesId: series._id,
            seasonNumber: seasonNum,
            title: `Season ${seasonNum}`,
            releaseYear,
          });
          await season.save().catch(() => {});
        }

        if (!season) season = await Season.findOne({ seriesId: series._id, seasonNumber: seasonNum });
        if (!season) return null;

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
          await episodeDoc.save().catch(() => {});
        }

        if (!episodeDoc) episodeDoc = await Episode.findOne({ seasonId: season._id, episodeNumber: episodeNum });

        if (episodeDoc) {
          await Media.findOneAndUpdate(
            { episodeId: episodeDoc._id, quality },
            {
              resolution: quality === '4K' ? '3840x2160' : '1920x1080',
              fileSize: raw.fileSize || '1.2 GB',
              streamUrl: defaultStream,
              downloadUrl: defaultDownload,
              provider: 'telegram',
              providerMediaId: raw.mediaId,
              providerMessageId: raw.messageId,
              status: 'active',
            },
            { upsert: true }
          );
        }

        return { type: 'series', series, season, episode: episodeDoc };
      } else {
        // Movie Post
        let movie = await Content.findOne({ $or: [{ title }, { slug: `${baseSlug}-${releaseYear}` }], type: 'movie' });
        if (!movie) {
          try {
            movie = new Content({
              title: tmdbMeta?.title || title,
              slug: `${baseSlug}-${releaseYear}`,
              type: 'movie',
              description,
              posterUrl: defaultPoster,
              backdropUrl: defaultBackdrop,
              releaseYear,
              genres,
              cast,
              languages,
              rating,
              status: 'published',
            });
            await movie.save();
          } catch {
            movie = await Content.findOne({ title, type: 'movie' });
          }
        }

        if (movie) {
          await Media.findOneAndUpdate(
            { contentId: movie._id, quality },
            {
              resolution: quality === '4K' ? '3840x2160' : '1920x1080',
              fileSize: raw.fileSize || '1.4 GB',
              streamUrl: defaultStream,
              downloadUrl: defaultDownload,
              provider: 'telegram',
              providerMediaId: raw.mediaId,
              providerMessageId: raw.messageId,
              status: 'active',
            },
            { upsert: true }
          );
        }

        return { type: 'movie', movie };
      }
    } catch (err) {
      console.warn('autoPublishTelegramPost note:', err);
      return null;
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
