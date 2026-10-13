import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { recommendationService } from '../services/recommendationService';
import { User } from '../models/User';

function parseArrayParam(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * GET /api/recommendations
 * Provides personalized recommendations according to user history, favorites, and interest preferences.
 * Seamlessly supports both authenticated users and anonymous guest viewers.
 */
export const getRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id?.toString();

    // Parse guest params from query or request body
    const guestData = {
      historyIds: parseArrayParam(req.query.historyIds || req.body?.historyIds),
      favoriteIds: parseArrayParam(req.query.favoriteIds || req.body?.favoriteIds),
      watchlistIds: parseArrayParam(req.query.watchlistIds || req.body?.watchlistIds),
      preferredGenres: parseArrayParam(req.query.genres || req.query.preferredGenres || req.body?.preferredGenres),
    };

    const limit = Math.min(30, Math.max(5, Number(req.query.limit || 15)));

    const feed = await recommendationService.getPersonalizedRecommendations({
      userId,
      guestData,
      limit,
    });

    return res.json({
      success: true,
      data: feed,
    });
  } catch (error: any) {
    console.error('getRecommendations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations',
      error: error.message,
    });
  }
};

/**
 * GET /api/recommendations/similar/:slugOrId
 * Returns similar titles based on genres, director, cast, and release era.
 */
export const getSimilarContent = async (req: AuthRequest, res: Response) => {
  try {
    const { slugOrId } = req.params;
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 10)));

    if (!slugOrId) {
      return res.status(400).json({ message: 'Content slug or ID is required' });
    }

    const items = await recommendationService.getSimilarContent(slugOrId, limit);

    return res.json({
      success: true,
      items,
    });
  } catch (error: any) {
    console.error('getSimilarContent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve similar content',
      error: error.message,
    });
  }
};

/**
 * GET /api/recommendations/taste-profile
 * Returns analytics on user's watching behavior, preferred genres, and completion counts.
 */
export const getUserTasteProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const profile = await recommendationService.getUserTasteProfile(req.user._id.toString());
    return res.json({ success: true, profile });
  } catch (error: any) {
    console.error('getUserTasteProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve taste profile',
      error: error.message,
    });
  }
};

/**
 * PUT /api/recommendations/preferences
 * Allows authenticated user to update their preferred genres/interests.
 */
export const updateUserPreferences = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { preferredGenres } = req.body;
    if (!Array.isArray(preferredGenres)) {
      return res.status(400).json({ message: 'preferredGenres must be an array of strings' });
    }

    const sanitized = preferredGenres.map((g) => String(g).trim()).filter(Boolean);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { preferredGenres: sanitized },
      { new: true }
    ).select('-password');

    return res.json({
      success: true,
      message: 'Taste preferences updated successfully',
      preferredGenres: user?.preferredGenres || [],
    });
  } catch (error: any) {
    console.error('updateUserPreferences error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message,
    });
  }
};
