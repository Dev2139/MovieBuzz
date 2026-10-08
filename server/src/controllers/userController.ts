import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { WatchHistory } from '../models/WatchHistory';
import { User } from '../models/User';
import { Content } from '../models/Content';

export const saveWatchHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { contentId, episodeId, progress, duration, completed } = req.body;

    if (!contentId || progress === undefined || duration === undefined) {
      return res.status(400).json({ message: 'ContentId, progress, and duration are required' });
    }

    const filter: any = { userId: req.user._id, contentId };
    if (episodeId) {
      filter.episodeId = episodeId;
    }

    const isCompleted = completed || (duration > 0 && progress / duration > 0.9);

    const historyDoc = await WatchHistory.findOneAndUpdate(
      filter,
      {
        progress,
        duration,
        completed: isCompleted,
        lastWatchedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.json({ history: historyDoc });
  } catch (error) {
    console.error('saveWatchHistory error:', error);
    return res.status(500).json({ message: 'Error updating watch history' });
  }
};

export const getContinueWatching = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const historyItems = await WatchHistory.find({
      userId: req.user._id,
      completed: false,
      progress: { $gt: 10 },
    })
      .sort({ lastWatchedAt: -1 })
      .limit(10)
      .populate('contentId')
      .populate('episodeId');

    return res.json({ continueWatching: historyItems });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching continue watching list' });
  }
};

export const getUserHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const history = await WatchHistory.find({ userId: req.user._id })
      .sort({ lastWatchedAt: -1 })
      .populate('contentId')
      .populate('episodeId');

    return res.json({ history });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching watch history' });
  }
};

export const deleteHistoryItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { historyId } = req.params;

    await WatchHistory.deleteOne({ _id: historyId, userId: req.user._id });
    return res.json({ message: 'History item removed successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting history item' });
  }
};

export const clearAllHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    await WatchHistory.deleteMany({ userId: req.user._id });
    return res.json({ message: 'Watch history cleared successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Error clearing watch history' });
  }
};

export const toggleFavorite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { contentId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const index = user.favorites.indexOf(contentId as any);
    let isFavorite = false;

    if (index > -1) {
      user.favorites.splice(index, 1);
    } else {
      user.favorites.push(contentId as any);
      isFavorite = true;
    }

    await user.save();
    return res.json({ favorites: user.favorites, isFavorite });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating favorites' });
  }
};

export const getFavorites = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const user = await User.findById(req.user._id).populate('favorites');
    return res.json({ favorites: user?.favorites || [] });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching favorites' });
  }
};

export const toggleWatchlist = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { contentId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const index = user.watchlist.indexOf(contentId as any);
    let inWatchlist = false;

    if (index > -1) {
      user.watchlist.splice(index, 1);
    } else {
      user.watchlist.push(contentId as any);
      inWatchlist = true;
    }

    await user.save();
    return res.json({ watchlist: user.watchlist, inWatchlist });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating watchlist' });
  }
};

export const getWatchlist = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const user = await User.findById(req.user._id).populate('watchlist');
    return res.json({ watchlist: user?.watchlist || [] });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching watchlist' });
  }
};

/**
 * Migration API for anonymous user playback history & watchlist
 * Takes local items and imports them safely into MongoDB for the authenticated account
 */
export const migrateLocalData = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { localHistory = [], localWatchlist = [], localFavorites = [] } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 1. Migrate Playback History
    for (const item of localHistory) {
      if (item.contentId && item.position > 0) {
        const filter: any = { userId: user._id, contentId: item.contentId };
        if (item.episodeId) filter.episodeId = item.episodeId;

        await WatchHistory.findOneAndUpdate(
          filter,
          {
            progress: item.position,
            duration: item.duration || 0,
            completed: item.percentage > 90,
            lastWatchedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          },
          { upsert: true, new: true }
        );
      }
    }

    // 2. Migrate Watchlist items without duplicates
    for (const contentId of localWatchlist) {
      if (!user.watchlist.includes(contentId)) {
        user.watchlist.push(contentId);
      }
    }

    // 3. Migrate Favorites items without duplicates
    for (const contentId of localFavorites) {
      if (!user.favorites.includes(contentId)) {
        user.favorites.push(contentId);
      }
    }

    await user.save();

    return res.json({
      message: 'Local browsing history and watchlist migrated successfully!',
      watchlistCount: user.watchlist.length,
      favoritesCount: user.favorites.length,
    });
  } catch (error) {
    console.error('migrateLocalData error:', error);
    return res.status(500).json({ message: 'Error migrating local user data' });
  }
};
