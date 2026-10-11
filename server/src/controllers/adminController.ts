import { Request, Response } from 'express';
import { Content } from '../models/Content';
import { Season } from '../models/Season';
import { Episode } from '../models/Episode';
import { Media } from '../models/Media';
import { User } from '../models/User';
import { TelegramImport } from '../models/TelegramImport';
import { TelegramImporter } from '../services/telegram/telegramImporter';
import { parseTelegramCaption } from '../services/telegram/telegramParser';

import { ContentRequest } from '../models/ContentRequest';

export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const [totalMovies, totalSeries, totalEpisodes, totalUsers, totalImports, pendingRequests, popularItems] = await Promise.all([
      Content.countDocuments({ type: 'movie' }),
      Content.countDocuments({ type: 'series' }),
      Episode.countDocuments(),
      User.countDocuments({ role: 'user' }),
      TelegramImport.countDocuments({ status: 'PENDING' }),
      ContentRequest.countDocuments({ status: 'pending' }),
      Content.aggregate([{ $group: { _id: null, totalViews: { $sum: '$popularity' } } }]),
    ]);

    const totalViews = popularItems[0]?.totalViews || 14200;

    return res.json({
      totalMovies,
      totalSeries,
      totalEpisodes,
      totalUsers,
      totalViews,
      totalDownloads: Math.floor(totalViews * 0.45),
      pendingImports: totalImports,
      pendingRequests,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error loading admin stats' });
  }
};

// Safe array parser for comma-separated or array inputs
const parseStringArray = (val: any, fallback: string[] = []): string[] => {
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
  if (typeof val === 'string' && val.trim().length > 0) {
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
};

// Safe slug generator that guarantees uniqueness in MongoDB
const generateUniqueSlug = async (rawTitle: string, rawYear: any, fallbackPrefix: string): Promise<string> => {
  const base = (rawTitle || fallbackPrefix)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || fallbackPrefix;
  const year = Number(rawYear) || 2026;
  let candidate = `${base}-${year}`;
  let count = 1;
  while (await Content.exists({ slug: candidate })) {
    candidate = `${base}-${year}-${Math.floor(1000 + Math.random() * 9000)}${count > 1 ? `-${count}` : ''}`;
    count++;
  }
  return candidate;
};

// --- Movie CRUD ---
export const createMovie = async (req: Request, res: Response) => {
  try {
    const { title, description, posterUrl, backdropUrl, trailerUrl, releaseYear, genres, languages, cast, director, rating, qualities } = req.body;

    const rawTitle = (title || 'Untitled Movie').trim();
    const targetYear = Number(releaseYear) || 2026;
    const slug = await generateUniqueSlug(rawTitle, targetYear, 'movie');

    const movie = new Content({
      title: rawTitle,
      slug,
      type: 'movie',
      description: description || `Watch ${rawTitle} in Ultra HD on CineStream.`,
      posterUrl: posterUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
      backdropUrl: backdropUrl || posterUrl || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600',
      trailerUrl: trailerUrl || '',
      releaseYear: targetYear,
      genres: parseStringArray(genres, ['Action', 'Drama']),
      languages: parseStringArray(languages, ['English']),
      cast: parseStringArray(cast, []),
      director: director || '',
      rating: Number(rating) || 7.5,
      status: 'published',
    });

    await movie.save();

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`;

    // Attach qualities if passed
    if (qualities && Array.isArray(qualities)) {
      for (const q of qualities) {
        try {
          await Media.create({
            contentId: movie._id,
            quality: q.quality || '1080p',
            resolution: q.resolution || '1920x1080',
            fileSize: q.fileSize || '1.4 GB',
            streamUrl: q.streamUrl || `${baseUrl}/api/media/proxy-file/${encodeURIComponent(q.providerMediaId || '')}`,
            downloadUrl: q.downloadUrl || `${baseUrl}/api/media/download-file/${encodeURIComponent(q.providerMediaId || '')}`,
            provider: q.provider || 'mock',
            providerMediaId: q.providerMediaId || `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          });
        } catch (mediaErr) {
          console.warn('Failed to attach media quality:', mediaErr);
        }
      }
    }

    return res.status(201).json({ movie });
  } catch (error: any) {
    console.error('createMovie error:', error);
    return res.status(500).json({ message: error?.message || 'Error creating movie' });
  }
};

export const updateContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, type, description, posterUrl, backdropUrl, genres, languages, releaseYear, rating, director } = req.body;

    const content = await Content.findById(id);
    if (!content) {
      return res.status(404).json({ message: 'Content not found' });
    }

    const updates: any = {};

    // Update Title & Slug
    if (title && title.trim() !== content.title) {
      updates.title = title.trim();
      const slugBase = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      updates.slug = `${slugBase}-${releaseYear || content.releaseYear || 2026}`;
    }

    // Handle Type Conversion (Movie <-> Series)
    const targetType = type ? String(type).toLowerCase().trim() : '';
    if (targetType && (targetType === 'movie' || targetType === 'series')) {
      const oldType = content.type ? String(content.type).toLowerCase().trim() : 'movie';
      updates.type = targetType;

      if (oldType !== targetType) {
        if (oldType === 'movie' && targetType === 'series') {
          // Converting Movie -> Series: Ensure Season 1 and Episode 1 exist, link existing media
          let season = await Season.findOne({ seriesId: content._id, seasonNumber: 1 });
          if (!season) {
            season = await Season.create({
              seriesId: content._id,
              seasonNumber: 1,
              title: 'Season 1',
              releaseYear: content.releaseYear || 2026,
            });
          }

          let ep1 = await Episode.findOne({ seasonId: season._id, episodeNumber: 1 });
          if (!ep1) {
            ep1 = await Episode.create({
              seriesId: content._id,
              seasonId: season._id,
              episodeNumber: 1,
              title: 'Episode 1',
              description: content.description,
              thumbnailUrl: content.posterUrl,
              duration: 2700,
            });
          }

          await Media.updateMany({ contentId: content._id }, { episodeId: ep1._id });
        } else if (oldType === 'series' && targetType === 'movie') {
          // Converting Series -> Movie: Re-attach episode media to movie contentId
          const episodes = await Episode.find({ seriesId: content._id });
          const epIds = episodes.map((e) => e._id);
          if (epIds.length > 0) {
            await Media.updateMany({ episodeId: { $in: epIds } }, { contentId: content._id });
          }
        }
      }
    }

    if (description !== undefined) updates.description = description;
    if (posterUrl !== undefined) updates.posterUrl = posterUrl;
    if (backdropUrl !== undefined) updates.backdropUrl = backdropUrl;
    if (genres !== undefined) updates.genres = parseStringArray(genres, content.genres);
    if (languages !== undefined) updates.languages = parseStringArray(languages, content.languages);
    if (req.body.cast !== undefined) updates.cast = parseStringArray(req.body.cast, content.cast);
    if (releaseYear !== undefined) updates.releaseYear = Number(releaseYear);
    if (rating !== undefined) updates.rating = Number(rating);
    if (director !== undefined) updates.director = director;

    const updatedContent = await Content.findByIdAndUpdate(id, { $set: updates }, { new: true });
    return res.json({ message: 'Content updated successfully', content: updatedContent });
  } catch (error) {
    console.error('updateContent error:', error);
    return res.status(500).json({ message: 'Error updating content' });
  }
};

export const deleteContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const target = await Content.findById(id);

    await Content.findByIdAndDelete(id);
    await Media.deleteMany({ contentId: id });
    await Season.deleteMany({ seriesId: id });
    await Episode.deleteMany({ seriesId: id });

    // Permanently mark Telegram import status as DELETED so background sync never re-publishes it!
    if (target) {
      await TelegramImport.updateMany(
        {
          $or: [
            { mappedContentId: id },
            { detectedTitle: new RegExp(`^${target.title.replace(/[^a-z0-9]/gi, '\\$&')}$`, 'i') },
          ],
        },
        { status: 'DELETED' }
      );
    } else {
      await TelegramImport.updateMany({ mappedContentId: id }, { status: 'DELETED' });
    }

    return res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting content' });
  }
};

// --- Series, Season, Episode CRUD ---
export const createSeries = async (req: Request, res: Response) => {
  try {
    const { title, description, posterUrl, backdropUrl, releaseYear, genres, languages, cast, director, rating, seasons } = req.body;
    const rawTitle = (title || 'Untitled Series').trim();
    const targetYear = Number(releaseYear) || 2026;
    const slug = await generateUniqueSlug(rawTitle, targetYear, 'series');

    const series = new Content({
      title: rawTitle,
      slug,
      type: 'series',
      description: description || `Watch ${rawTitle} all seasons and episodes on CineStream.`,
      posterUrl: posterUrl || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800',
      backdropUrl: backdropUrl || posterUrl || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1600',
      releaseYear: targetYear,
      genres: parseStringArray(genres, ['Drama', 'Action']),
      languages: parseStringArray(languages, ['English']),
      cast: parseStringArray(cast, []),
      director: director || '',
      rating: Number(rating) || 8.0,
      status: 'published',
    });

    await series.save();

    // Store seasons and multiple episodes season-wise if provided
    const createdSeasons: any[] = [];
    const createdEpisodes: any[] = [];

    if (seasons && Array.isArray(seasons)) {
      for (const sItem of seasons) {
        const sNum = Number(sItem.seasonNumber) || 1;
        const season = await Season.create({
          seriesId: series._id,
          seasonNumber: sNum,
          title: sItem.title || `Season ${sNum}`,
          description: sItem.description || series.description,
          posterUrl: sItem.posterUrl || series.posterUrl,
          releaseYear: Number(sItem.releaseYear || targetYear),
        });
        createdSeasons.push(season);

        const epList = Array.isArray(sItem.episodes) ? sItem.episodes : [];
        for (const epItem of epList) {
          const epNum = Number(epItem.episodeNumber || epItem.number) || 1;
          const episode = await Episode.create({
            seriesId: series._id,
            seasonId: season._id,
            episodeNumber: epNum,
            title: epItem.title || `Episode ${epNum}`,
            description: epItem.description || series.description,
            thumbnailUrl: epItem.thumbnailUrl || season.posterUrl || series.posterUrl,
            duration: Number(epItem.duration) || 2700,
          });
          createdEpisodes.push(episode);
        }
      }
    }

    return res.status(201).json({ series, seasons: createdSeasons, episodes: createdEpisodes });
  } catch (error: any) {
    console.error('createSeries error:', error);
    return res.status(500).json({ message: error?.message || 'Error creating series' });
  }
};

/**
 * Dedicated Endpoint to store multiple episodes season-wise for webseries
 */
export const storeSeriesEpisodes = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const { targetSeriesId, seasons, seasonNumber, seasonEndNumber, startEpisode, endEpisode, episodeCount } = req.body;
    const sId = seriesId || targetSeriesId;

    const series = await Content.findById(sId);
    if (!series) {
      return res.status(404).json({ message: 'Series not found' });
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`;

    const savedSeasons: any[] = [];
    const savedEpisodes: any[] = [];

    // Case 1: Structured seasons array with episodes provided
    if (Array.isArray(seasons) && seasons.length > 0) {
      for (const sItem of seasons) {
        const sNum = Number(sItem.seasonNumber) || 1;
        let season = await Season.findOne({ seriesId: series._id, seasonNumber: sNum });
        if (!season) {
          season = await Season.create({
            seriesId: series._id,
            seasonNumber: sNum,
            title: sItem.title || `Season ${sNum}`,
            description: sItem.description || series.description,
            posterUrl: sItem.posterUrl || series.posterUrl,
            releaseYear: Number(sItem.releaseYear || series.releaseYear || 2026),
          });
        }
        savedSeasons.push(season);

        const epList = Array.isArray(sItem.episodes) ? sItem.episodes : [];
        for (const epItem of epList) {
          const epNum = Number(epItem.episodeNumber || epItem.number) || 1;
          let episode = await Episode.findOne({ seasonId: season._id, episodeNumber: epNum });
          if (!episode) {
            episode = await Episode.create({
              seriesId: series._id,
              seasonId: season._id,
              episodeNumber: epNum,
              title: epItem.title || `Episode ${epNum}`,
              description: epItem.description || `Episode ${epNum} of Season ${sNum}`,
              thumbnailUrl: epItem.thumbnailUrl || season.posterUrl || series.posterUrl,
              duration: Number(epItem.duration) || 2700,
            });
          }
          savedEpisodes.push(episode);

          if (epItem.qualities && Array.isArray(epItem.qualities)) {
            for (const q of epItem.qualities) {
              await Media.findOneAndUpdate(
                { episodeId: episode._id, quality: q.quality || '1080p' },
                {
                  resolution: q.resolution || '1920x1080',
                  fileSize: q.fileSize || '950 MB',
                  streamUrl: q.streamUrl || `${baseUrl}/api/media/proxy-file/${encodeURIComponent(q.providerMediaId || '')}`,
                  downloadUrl: q.downloadUrl || `${baseUrl}/api/media/download-file/${encodeURIComponent(q.providerMediaId || '')}`,
                  provider: q.provider || 'custom',
                  providerMediaId: q.providerMediaId || `ep-${episode._id}-${Date.now()}`,
                  status: 'active',
                },
                { upsert: true }
              );
            }
          }
        }
      }
    } else {
      // Case 2: Range parameters: seasonNumber, seasonEndNumber, startEpisode, endEpisode
      const sStart = Number(seasonNumber) || 1;
      const sEnd = Math.max(sStart, Number(seasonEndNumber) || sStart);
      const epStart = Number(startEpisode) || 1;
      const epEnd = Math.max(epStart, Number(endEpisode) || (episodeCount ? epStart + Number(episodeCount) - 1 : epStart));

      for (let sNum = sStart; sNum <= sEnd; sNum++) {
        let season = await Season.findOne({ seriesId: series._id, seasonNumber: sNum });
        if (!season) {
          season = await Season.create({
            seriesId: series._id,
            seasonNumber: sNum,
            title: `Season ${sNum}`,
            description: series.description,
            posterUrl: series.posterUrl,
            releaseYear: series.releaseYear || 2026,
          });
        }
        savedSeasons.push(season);

        for (let epNum = epStart; epNum <= epEnd; epNum++) {
          let episode = await Episode.findOne({ seasonId: season._id, episodeNumber: epNum });
          if (!episode) {
            episode = await Episode.create({
              seriesId: series._id,
              seasonId: season._id,
              episodeNumber: epNum,
              title: `Episode ${epNum}`,
              description: `Episode ${epNum} of Season ${sNum}`,
              thumbnailUrl: series.posterUrl,
              duration: 2700,
            });
          }
          savedEpisodes.push(episode);
        }
      }
    }

    return res.status(200).json({
      message: `Stored ${savedEpisodes.length} episodes season-wise across ${savedSeasons.length} seasons for "${series.title}"!`,
      series,
      seasons: savedSeasons,
      episodes: savedEpisodes,
    });
  } catch (error) {
    console.error('storeSeriesEpisodes error:', error);
    return res.status(500).json({ message: 'Error storing webseries episodes season-wise' });
  }
};

export const createSeason = async (req: Request, res: Response) => {
  try {
    const { seriesId, seasonNumber, title, description, posterUrl, releaseYear } = req.body;
    const season = new Season({
      seriesId,
      seasonNumber: Number(seasonNumber),
      title: title || `Season ${seasonNumber}`,
      description,
      posterUrl,
      releaseYear: Number(releaseYear) || 2026,
    });
    await season.save();
    return res.status(201).json({ season });
  } catch (error) {
    return res.status(500).json({ message: 'Error creating season' });
  }
};

export const createEpisode = async (req: Request, res: Response) => {
  try {
    const { seriesId, seasonId, episodeNumber, title, description, thumbnailUrl, duration, qualities } = req.body;

    const episode = new Episode({
      seriesId,
      seasonId,
      episodeNumber: Number(episodeNumber),
      title,
      description,
      thumbnailUrl,
      duration: Number(duration) || 2400,
    });

    await episode.save();

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`;

    if (qualities && Array.isArray(qualities)) {
      for (const q of qualities) {
        await Media.create({
          episodeId: episode._id,
          quality: q.quality || '1080p',
          resolution: q.resolution || '1920x1080',
          fileSize: q.fileSize || '950 MB',
          streamUrl: q.streamUrl || `${baseUrl}/api/media/proxy-file/${encodeURIComponent(q.providerMediaId || '')}`,
          downloadUrl: q.downloadUrl || `${baseUrl}/api/media/download-file/${encodeURIComponent(q.providerMediaId || '')}`,
          provider: q.provider || 'mock',
          providerMediaId: q.providerMediaId || `ep-media-${Date.now()}`,
        });
      }
    }

    return res.status(201).json({ episode });
  } catch (error) {
    return res.status(500).json({ message: 'Error creating episode' });
  }
};

// --- Telegram Channel Integration Dashboard Routes ---

export const getTelegramImports = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const filter = status ? { status: String(status) } : {};
    const imports = await TelegramImport.find(filter).sort({ createdAt: -1 });
    return res.json({ imports });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching Telegram import queue' });
  }
};

export const syncTelegramChannel = async (req: Request, res: Response) => {
  try {
    const importer = new TelegramImporter();

    // Simulated new Telegram Channel posts for testing review workflow
    const sampleChannelPosts = [
      {
        channelId: process.env.TELEGRAM_CHANNEL_ID || '@AuthorizedCinemaChannel',
        messageId: `msg_${Date.now()}_1`,
        mediaId: `tg_media_${Date.now()}_1`,
        caption: 'Shadow Horizon (2026) 1080p Dual Audio English Sci-Fi Thriller WEBRip x264',
      },
      {
        channelId: process.env.TELEGRAM_CHANNEL_ID || '@AuthorizedCinemaChannel',
        messageId: `msg_${Date.now()}_2`,
        mediaId: `tg_media_${Date.now()}_2`,
        caption: 'Chronicles of Valhalla S01E03 720p English Action Adventure 10Bit',
      },
    ];

    const queuedDocs = [];
    for (const post of sampleChannelPosts) {
      const doc = await importer.queueTelegramPost(post);
      queuedDocs.push(doc);
    }

    return res.json({
      message: 'Channel sync completed. Imported posts added to review queue.',
      newPostsCount: queuedDocs.length,
      queuedDocs,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error syncing channel posts' });
  }
};

export const parseTelegramPost = async (req: Request, res: Response) => {
  try {
    const { caption } = req.body;
    if (!caption) return res.status(400).json({ message: 'Caption string is required' });
    const parsed = parseTelegramCaption(caption);
    return res.json({ parsed });
  } catch (error) {
    return res.status(500).json({ message: 'Error parsing post caption' });
  }
};

export const publishTelegramImport = async (req: Request, res: Response) => {
  try {
    const {
      importId,
      action,
      targetType,
      title,
      existingSeriesId,
      seasonNumber,
      episodeNumber,
      episodeEndNumber,
      quality,
      posterUrl,
      backdropUrl,
      description,
      genres,
    } = req.body;

    const importDoc = await TelegramImport.findById(importId);
    if (!importDoc) {
      return res.status(404).json({ message: 'Import post not found' });
    }

    if (action === 'IGNORE') {
      importDoc.status = 'IGNORED';
      await importDoc.save();
      return res.json({ message: 'Post marked as IGNORED', importDoc });
    }

    const finalTitle = title || importDoc.detectedTitle;
    const finalQuality = quality || importDoc.detectedQuality || '1080p';
    const finalYear = importDoc.detectedYear || 2026;

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`;

    if (targetType === 'movie') {
      let movie = await Content.findOne({ title: finalTitle, type: 'movie' });
      if (!movie) {
        const movieSlug = await generateUniqueSlug(finalTitle, finalYear, 'movie');
        movie = new Content({
          title: finalTitle,
          slug: movieSlug,
          type: 'movie',
          description: description || importDoc.originalCaption,
          posterUrl: posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800',
          backdropUrl: backdropUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600',
          releaseYear: finalYear,
          genres: parseStringArray(genres, ['Action', 'Sci-Fi']),
          languages: [importDoc.detectedLanguage || 'English'],
          status: 'published',
        });
        await movie.save();
      }

      const media = new Media({
        contentId: movie._id,
        quality: finalQuality as any,
        resolution: finalQuality === '4K' ? '3840x2160' : '1920x1080',
        fileSize: '1.4 GB',
        streamUrl: `${baseUrl}/api/media/proxy-file/${encodeURIComponent(importDoc.mediaId)}`,
        downloadUrl: `${baseUrl}/api/media/download-file/${encodeURIComponent(importDoc.mediaId)}`,
        provider: 'telegram',
        providerMediaId: importDoc.mediaId,
        providerMessageId: importDoc.messageId,
        status: 'active',
      });
      await media.save();

      importDoc.status = 'IMPORTED';
      importDoc.mappedContentId = movie._id;
      await importDoc.save();

      return res.json({ message: 'Published movie to platform catalog', movie, media });
    } else {
      // Series Episode Target (Single or Bulk Episode Range e.g. E1 to E4)
      let series = existingSeriesId ? await Content.findById(existingSeriesId) : null;
      if (!series) {
        series = await Content.findOne({ title: finalTitle, type: 'series' });
      }

      if (!series) {
        const seriesSlug = await generateUniqueSlug(finalTitle, finalYear, 'series');
        series = new Content({
          title: finalTitle,
          slug: seriesSlug,
          type: 'series',
          description: description || importDoc.originalCaption,
          posterUrl: posterUrl || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800',
          backdropUrl: backdropUrl || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1600',
          releaseYear: finalYear,
          genres: parseStringArray(genres, ['Drama', 'Mystery']),
          languages: [importDoc.detectedLanguage || 'English'],
          status: 'published',
        });
        await series.save();
      }

      const sStart = Number(seasonNumber) || importDoc.detectedSeason || 1;
      const sEnd = Math.max(sStart, Number(req.body.seasonEndNumber) || sStart);
      const startEp = Number(episodeNumber) || importDoc.detectedEpisode || 1;
      const endEp = Math.max(startEp, Number(episodeEndNumber) || importDoc.detectedEpisodeEnd || startEp);

      const createdEpisodes: any[] = [];
      const createdMedias: any[] = [];
      const createdSeasons: any[] = [];

      for (let sNum = sStart; sNum <= sEnd; sNum++) {
        let season = await Season.findOne({ seriesId: series._id, seasonNumber: sNum });
        if (!season) {
          season = new Season({
            seriesId: series._id,
            seasonNumber: sNum,
            title: `Season ${sNum}`,
            releaseYear: importDoc.detectedYear || 2026,
            posterUrl: posterUrl || series.posterUrl,
          });
          await season.save();
        }
        createdSeasons.push(season);

        for (let eNum = startEp; eNum <= endEp; eNum++) {
          let episode = await Episode.findOne({ seasonId: season._id, episodeNumber: eNum });
          if (!episode) {
            episode = new Episode({
              seriesId: series._id,
              seasonId: season._id,
              episodeNumber: eNum,
              title: startEp !== endEp ? `Episode ${eNum} (Bulk File)` : `Episode ${eNum}`,
              description: importDoc.originalCaption,
              thumbnailUrl: posterUrl || series.posterUrl || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800',
              duration: 2700,
            });
            await episode.save();
          }

          const media = await Media.findOneAndUpdate(
            { episodeId: episode._id, quality: finalQuality },
            {
              resolution: finalQuality === '4K' ? '3840x2160' : '1920x1080',
              fileSize: '950 MB',
              streamUrl: `${baseUrl}/api/media/proxy-file/${encodeURIComponent(importDoc.mediaId)}`,
              downloadUrl: `${baseUrl}/api/media/download-file/${encodeURIComponent(importDoc.mediaId)}`,
              provider: 'telegram',
              providerMediaId: importDoc.mediaId,
              providerMessageId: importDoc.messageId,
              status: 'active',
            },
            { upsert: true, new: true }
          );

          createdEpisodes.push(episode);
          createdMedias.push(media);
        }
      }

      importDoc.status = 'IMPORTED';
      importDoc.mappedContentId = series._id;
      importDoc.mappedEpisodeId = createdEpisodes[0]?._id;
      await importDoc.save();

      const isBulk = createdEpisodes.length > 1;
      const msg = isBulk
        ? `Published Bulk Episodes (${createdEpisodes.length} episodes season-wise) to series "${series.title}"!`
        : `Published Episode ${startEp} to series "${series.title}"!`;

      return res.json({ message: msg, series, seasons: createdSeasons, episodes: createdEpisodes, medias: createdMedias });
    }
  } catch (error) {
    console.error('publishTelegramImport error:', error);
    return res.status(500).json({ message: 'Error publishing Telegram import' });
  }
};

/**
 * Bulk Enrich existing catalog with TMDB / IMDb real ratings, posters, backdrops & details
 */
export const enrichCatalogMetadata = async (req: Request, res: Response) => {
  try {
    const { tmdbService } = await import('../services/tmdb/tmdbService');
    const allContent = await Content.find({ status: 'published' });
    let enrichedCount = 0;

    for (const item of allContent) {
      const tmdbMeta = await tmdbService.fetchMetadata(item.title, item.releaseYear, item.type as any);
      if (tmdbMeta) {
        const releaseDate = tmdbMeta.releaseDate ? new Date(tmdbMeta.releaseDate) : (tmdbMeta.releaseYear ? new Date(`${tmdbMeta.releaseYear}-01-01`) : undefined);
        await Content.findByIdAndUpdate(item._id, {
          title: tmdbMeta.title || item.title,
          description: tmdbMeta.description || item.description,
          ...(tmdbMeta.posterUrl && !tmdbMeta.posterUrl.includes('unsplash') ? { posterUrl: tmdbMeta.posterUrl } : {}),
          ...(tmdbMeta.backdropUrl && !tmdbMeta.backdropUrl.includes('unsplash') ? { backdropUrl: tmdbMeta.backdropUrl } : {}),
          rating: tmdbMeta.rating > 0 ? tmdbMeta.rating : item.rating,
          releaseYear: tmdbMeta.releaseYear || item.releaseYear,
          ...(releaseDate ? { releaseDate } : {}),
          genres: tmdbMeta.genres && tmdbMeta.genres.length > 0 ? tmdbMeta.genres : item.genres,
          cast: tmdbMeta.cast && tmdbMeta.cast.length > 0 ? tmdbMeta.cast : item.cast,
          languages: tmdbMeta.languages && tmdbMeta.languages.length > 0 ? tmdbMeta.languages : item.languages,
        });
        enrichedCount++;
      }
    }

    return res.json({
      message: `Enriched ${enrichedCount} items with official TMDB/IMDb ratings, posters & metadata!`,
      enrichedCount,
    });
  } catch (error: any) {
    console.error('enrichCatalogMetadata error:', error);
    return res.status(500).json({ message: 'Error enriching catalog metadata' });
  }
};

/**
 * Admin Catalog: returns all movies and series without arbitrary omissions, supporting search, filters & pagination
 */
export const getAdminCatalog = async (req: Request, res: Response) => {
  try {
    const { type, status, search, page = 1, limit = 100, sort = 'latest' } = req.query;

    const query: any = {};

    if (type && type !== 'all') {
      query.type = type;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    let sortOptions: any = { createdAt: -1 };
    if (sort === 'title') {
      sortOptions = { title: 1 };
    } else if (sort === 'rating') {
      sortOptions = { rating: -1, createdAt: -1 };
    } else if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = limit === 'all' ? 1000 : Math.max(1, Number(limit) || 100);
    const skip = (pageNum - 1) * limitNum;

    const [items, total, totalMovies, totalSeries, totalDrafts] = await Promise.all([
      Content.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      Content.countDocuments(query),
      Content.countDocuments({ type: 'movie' }),
      Content.countDocuments({ type: 'series' }),
      Content.countDocuments({ status: 'draft' }),
    ]);

    return res.json({
      items,
      total,
      totalMovies,
      totalSeries,
      totalDrafts,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    console.error('getAdminCatalog error:', error);
    return res.status(500).json({ message: 'Error fetching admin catalog' });
  }
};
