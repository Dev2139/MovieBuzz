import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Content } from '../models/Content';
import { Media } from '../models/Media';
import { tmdbService } from '../services/tmdb/tmdbService';

export const getContentList = async (req: Request, res: Response) => {
  try {
    const { type, genre, language, year, sort, limit = 20, page = 1, featured } = req.query;

    const query: any = { status: { $ne: 'draft' } };

    if (type && (type === 'movie' || type === 'series')) {
      query.type = new RegExp(`^${type}$`, 'i');
    }

    if (genre) {
      query.genres = genre;
    }

    if (language) {
      query.languages = language;
    }

    if (year) {
      query.releaseYear = Number(year);
    }

    if (featured === 'true') {
      query.featured = true;
    }

    let sortOptions: any = { releaseDate: -1, releaseYear: -1, createdAt: -1 };
    if (sort === 'popular') {
      sortOptions = { popularity: -1, releaseDate: -1, releaseYear: -1 };
    } else if (sort === 'rating') {
      sortOptions = { rating: -1, releaseDate: -1, releaseYear: -1 };
    } else if (sort === 'title') {
      sortOptions = { title: 1 };
    } else if (sort === 'latest' || sort === 'releaseDate' || !sort) {
      sortOptions = { releaseDate: -1, releaseYear: -1, createdAt: -1 };
    } else if (sort === 'recentlyAdded' || sort === 'posted') {
      sortOptions = { createdAt: -1 };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Content.find(query).sort(sortOptions).skip(skip).limit(Number(limit)),
      Content.countDocuments(query),
    ]);

    // Auto-enrich any items asynchronously if they still miss release date, real rating or real artwork
    for (const item of items) {
      const needsEnrichment =
        !item.releaseDate ||
        !item.posterUrl ||
        item.posterUrl.includes('unsplash') ||
        item.rating === 0 ||
        item.rating === 8.5 ||
        item.rating === 10;

      if (needsEnrichment) {
        tmdbService.fetchMetadata(item.title, item.releaseYear, item.type as any).then((meta) => {
          if (meta) {
            const releaseDate = meta.releaseDate ? new Date(meta.releaseDate) : (meta.releaseYear ? new Date(`${meta.releaseYear}-01-01`) : undefined);
            Content.findByIdAndUpdate(item._id, {
              ...(meta.posterUrl && !meta.posterUrl.includes('unsplash') ? { posterUrl: meta.posterUrl } : {}),
              ...(meta.backdropUrl && !meta.backdropUrl.includes('unsplash') ? { backdropUrl: meta.backdropUrl } : {}),
              ...(meta.rating > 0 ? { rating: meta.rating } : {}),
              ...(meta.description ? { description: meta.description } : {}),
              ...(meta.genres?.length ? { genres: meta.genres } : {}),
              ...(meta.cast?.length ? { cast: meta.cast } : {}),
              ...(meta.director ? { director: meta.director } : {}),
              ...(releaseDate ? { releaseDate } : {}),
              ...(meta.releaseYear ? { releaseYear: meta.releaseYear } : {}),
              ...(meta.tmdbId ? { tmdbId: meta.tmdbId } : {}),
              ...(meta.imdbId ? { imdbId: meta.imdbId } : {}),
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    return res.json({
      items,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error: any) {
    console.warn('getContentList notice:', error.message);
    return res.json({
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });
  }
};

export const getContentBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    let item = await Content.findOne({ slug, status: 'published' });
    if (!item && mongoose.Types.ObjectId.isValid(slug)) {
      item = await Content.findOne({ _id: slug, status: 'published' });
    }

    if (!item) {
      return res.status(404).json({ message: 'Content not found' });
    }

    // Increment popularity/views counter silently
    await Content.findByIdAndUpdate(item._id, { $inc: { popularity: 1 } }).catch(() => {});

    // Fetch available media qualities for movies
    let availableMedia: any[] = [];
    if (item.type === 'movie') {
      availableMedia = await Media.find({ contentId: item._id, status: 'active' }).catch(() => []);
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const normalizedMedia = availableMedia.map((m) => {
      const obj = m.toObject ? m.toObject() : { ...m };
      if (obj.provider === 'telegram' && obj.providerMediaId) {
        obj.streamUrl = `${baseUrl}/api/media/proxy-file/${encodeURIComponent(obj.providerMediaId)}`;
      } else if (obj.streamUrl && obj.streamUrl.startsWith('http://localhost:5000')) {
        obj.streamUrl = obj.streamUrl.replace('http://localhost:5000', baseUrl);
      }
      return obj;
    });

    return res.json({
      content: item,
      media: normalizedMedia,
    });
  } catch (error: any) {
    console.warn('getContentBySlug notice:', error.message);
    return res.status(404).json({ message: 'Content not found' });
  }
};

export const getMovies = async (req: Request, res: Response) => {
  req.query.type = 'movie';
  return getContentList(req, res);
};

export const getSeries = async (req: Request, res: Response) => {
  req.query.type = 'series';
  return getContentList(req, res);
};

export const getGenres = async (req: Request, res: Response) => {
  try {
    const genres = await Content.distinct('genres', { status: 'published' });
    if (genres && genres.length > 0) {
      return res.json({ genres: genres.filter(Boolean).sort() });
    }
  } catch (error: any) {
    console.warn('getGenres notice:', error.message);
  }

  // Safe fallback default genres list so frontend never receives a 500 error
  return res.json({
    genres: [
      'Action',
      'Adventure',
      'Animation',
      'Comedy',
      'Crime',
      'Drama',
      'Fantasy',
      'Horror',
      'Mystery',
      'Romance',
      'Sci-Fi',
      'Thriller',
    ],
  });
};

export const syncTelegramPosts = async (req: Request, res: Response) => {
  try {
    const { storageService } = await import('../services/telegram/telegramService');
    const client = storageService.getTelegramClient();
    if (client) {
      const count = await client.syncChannelPosts();
      return res.json({ message: 'Sync completed', importedCount: count });
    }
    return res.json({ message: 'Telegram client not configured', importedCount: 0 });
  } catch (err: any) {
    return res.status(500).json({ message: 'Sync error', error: err.message });
  }
};

/**
 * Force-resync: resets the lastUpdateId so getUpdates starts from the beginning again.
 * Use this when a post was sent before the server polled and was missed.
 */
export const forceResyncTelegramPosts = async (req: Request, res: Response) => {
  try {
    const { storageService } = await import('../services/telegram/telegramService');
    const client = storageService.getTelegramClient();
    if (!client) {
      return res.json({ message: 'Telegram client not configured', importedCount: 0 });
    }

    // Reset the lastUpdateId to 0 so ALL unacknowledged updates are refetched
    (client as any).lastUpdateId = 0;
    const count = await client.syncChannelPosts();
    return res.json({ message: 'Force resync completed', importedCount: count });
  } catch (err: any) {
    return res.status(500).json({ message: 'Force resync error', error: err.message });
  }
};

/**
 * Diagnostic: Shows what Telegram Bot API currently has in the update queue WITHOUT consuming them.
 * Use this to debug why posts are not being picked up.
 */
export const diagnosticTelegramUpdates = async (req: Request, res: Response) => {
  try {
    const axios = (await import('axios')).default;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ message: 'TELEGRAM_BOT_TOKEN not set' });
    }

    // Use negative offset (-100) to peek at last updates without confirming them
    const peekUrl = `https://api.telegram.org/bot${botToken}/getUpdates?offset=-100&limit=10`;
    const peekRes = await axios.get(peekUrl, { timeout: 10000 });

    const updates = peekRes.data?.result || [];
    const summary = updates.map((u: any) => {
      const post = u.channel_post || u.message;
      return {
        update_id: u.update_id,
        type: u.channel_post ? 'channel_post' : u.message ? 'message' : 'other',
        caption: post?.caption || post?.text || '(no text)',
        has_video: Boolean(post?.video),
        has_document: Boolean(post?.document),
        file_id: post?.video?.file_id || post?.document?.file_id || null,
        chat_id: post?.chat?.id,
        date: post?.date ? new Date(post.date * 1000).toISOString() : null,
      };
    });

    return res.json({
      total: updates.length,
      note: updates.length === 0
        ? 'No updates in queue. If you sent a post before the last sync, it was already consumed. Please resend the video to the bot.'
        : 'These updates are in queue but not yet processed.',
      updates: summary,
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Diagnostic error', error: err.message });
  }
};


export const handleTelegramWebhook = async (req: Request, res: Response) => {
  try {
    const { storageService } = await import('../services/telegram/telegramService');
    const client = storageService.getTelegramClient();
    if (client && req.body) {
      const published = await client.handleWebhookUpdate(req.body);
      return res.json({ ok: true, published });
    }
    return res.json({ ok: true, published: false });
  } catch (err: any) {
    console.warn('[Webhook] Telegram webhook processing notice:', err.message);
    return res.json({ ok: true, published: false });
  }
};

/**
 * Debug: Check TelegramImport history — shows all records regardless of status.
 * Use to diagnose why posts were not imported.
 */
export const debugTelegramImports = async (req: Request, res: Response) => {
  try {
    const { TelegramImport } = await import('../models/TelegramImport');
    const imports = await TelegramImport.find({}).sort({ createdAt: -1 }).limit(20).lean();
    return res.json({
      total: imports.length,
      note: imports.length === 0
        ? 'No import records found. Either no posts were ever sent to the bot, or they were silently skipped.'
        : 'These are the last 20 import attempts.',
      imports: imports.map((i: any) => ({
        messageId: i.messageId,
        status: i.status,
        detectedTitle: i.detectedTitle,
        detectedQuality: i.detectedQuality,
        originalCaption: i.originalCaption?.slice(0, 100),
        createdAt: i.createdAt,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Debug error', error: err.message });
  }
};

/**
 * Manual Import: Directly process a Telegram video by providing its file_id and caption.
 * Use this when getUpdates already consumed the update and the post wasn't auto-imported.
 * POST /api/telegram/manual-import
 * Body: { fileId: "TELEGRAM_FILE_ID", caption: "Movie Name (2026) 1080p", messageId?: "123" }
 */
export const manualTelegramImport = async (req: Request, res: Response) => {
  try {
    const { fileId, caption, messageId } = req.body;
    if (!fileId || !caption) {
      return res.status(400).json({ message: 'fileId and caption are required' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const backendUrl = process.env.BACKEND_URL || 'https://moviebuzz-99fb.onrender.com';

    const streamUrl = `${backendUrl}/api/media/proxy-file/${encodeURIComponent(fileId)}`;
    const downloadUrl = `${backendUrl}/api/media/download-file/${encodeURIComponent(fileId)}`;

    const { TelegramImporter } = await import('../services/telegram/telegramImporter');
    const importer = new TelegramImporter();

    const result = await importer.autoPublishTelegramPost({
      channelId: process.env.TELEGRAM_CHANNEL_ID || 'manual',
      messageId: messageId || `manual_${Date.now()}`,
      mediaId: fileId,
      caption,
      streamUrl,
      downloadUrl,
    });

    if (result) {
      return res.json({ success: true, message: 'Content imported successfully!', result });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Import returned null — either the caption could not be parsed, or this post was already imported/ignored.',
        tip: 'Check /api/telegram/debug-imports to see the import history.',
      });
    }
  } catch (err: any) {
    return res.status(500).json({ message: 'Manual import error', error: err.message });
  }
};
