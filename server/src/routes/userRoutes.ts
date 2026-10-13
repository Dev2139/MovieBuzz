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
  getUserPreferences,
  updateUserPreferences,
} from '../controllers/userController';
import {
  trackWatchTime,
  getUserCoins,
  redeemCoins,
  purchaseSubscription,
  listSubscriptionPlans,
  saveUpiId,
} from '../controllers/coinsController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/preferences', getUserPreferences);
router.put('/preferences', updateUserPreferences);

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

// --- CineCoins loyalty system ---
router.get('/subscription/plans', listSubscriptionPlans);
router.post('/subscription/purchase', purchaseSubscription);
router.post('/coins/track', trackWatchTime);
router.get('/coins', getUserCoins);
router.post('/coins/redeem', redeemCoins);
router.post('/coins/upi', saveUpiId);

export default router;
