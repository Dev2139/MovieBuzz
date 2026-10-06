import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Content } from '../models/Content';
import { Season } from '../models/Season';
import { Episode } from '../models/Episode';
import { Media } from '../models/Media';

dotenv.config();

async function cleanCatalog() {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinestream';
    await mongoose.connect(connStr);
    console.log('[Clean] Connected to MongoDB');

    // Find non-Telegram media IDs
    const mockMedia = await Media.find({ provider: { $ne: 'telegram' } });
    const mockMediaIds = mockMedia.map((m) => m._id);

    // Delete non-Telegram media, content, seasons, and episodes
    await Media.deleteMany({ provider: { $ne: 'telegram' } });

    // Keep only content associated with Telegram provider media
    const activeTelegramMedia = await Media.find({ provider: 'telegram' });
    const activeContentIds = activeTelegramMedia.map((m) => m.contentId).filter(Boolean);
    const activeEpisodeIds = activeTelegramMedia.map((m) => m.episodeId).filter(Boolean);

    await Content.deleteMany({ _id: { $nin: activeContentIds } });
    await Season.deleteMany({});
    await Episode.deleteMany({ _id: { $nin: activeEpisodeIds } });

    console.log('[Clean] Removed all mock/seed movies!');
    console.log(`[Clean] Retained ${activeTelegramMedia.length} real Telegram imported media items.`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[Clean] Error cleaning catalog:', error);
    process.exit(1);
  }
}

cleanCatalog();
