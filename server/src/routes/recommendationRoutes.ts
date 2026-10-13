import { Router } from 'express';
import {
  getRecommendations,
  getSimilarContent,
  getUserTasteProfile,
  updateUserPreferences,
} from '../controllers/recommendationController';
import { optionalAuth, authenticate } from '../middleware/authMiddleware';

const router = Router();

// Personalized feed (optional auth: supports both logged in users and guest profiles)
router.get('/', optionalAuth, getRecommendations);
router.post('/feed', optionalAuth, getRecommendations);

// Content similarity for "More Like This" / "Up Next"
router.get('/similar/:slugOrId', optionalAuth, getSimilarContent);

// Taste Profile and Interest Preferences
router.get('/taste-profile', authenticate, getUserTasteProfile);
router.put('/preferences', authenticate, updateUserPreferences);

export default router;
