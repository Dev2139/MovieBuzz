import { Router } from 'express';
import {
  saveWatchHistory,
  getContinueWatching,
  getUserHistory,
  deleteHistoryItem,
  clearAllHistory,
  toggleFavorite,
  getFavorites,
  toggleWatchlist,
  getWatchlist,
  migrateLocalData,
} from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/history', saveWatchHistory);
router.get('/history', getUserHistory);
router.delete('/history/:historyId', deleteHistoryItem);
router.delete('/history', clearAllHistory);
router.get('/continue-watching', getContinueWatching);

router.get('/favorites', getFavorites);
router.post('/favorites/:contentId', toggleFavorite);
router.delete('/favorites/:contentId', toggleFavorite);

router.get('/watchlist', getWatchlist);
router.post('/watchlist/:contentId', toggleWatchlist);
router.delete('/watchlist/:contentId', toggleWatchlist);

router.post('/migrate-local-data', migrateLocalData);

export default router;
