import { Router } from 'express';
import {
  getAdminStats,
  getAdminCatalog,
  createMovie,
  createSeries,
  storeSeriesEpisodes,
  createSeason,
  createEpisode,
  updateContent,
  deleteContent,
  getTelegramImports,
  syncTelegramChannel,
  parseTelegramPost,
  publishTelegramImport,
  enrichCatalogMetadata,
  getAdminUsers,
  toggleUserPremium,
} from '../controllers/adminController';
import {
  getAdminRequests,
  updateRequestStatus,
  deleteRequest,
} from '../controllers/requestController';
import {
  adminListRedemptions,
  adminApproveRedemption,
  adminRejectRedemption,
  adminCoinsStats,
} from '../controllers/coinsController';
import { authenticate, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/stats', getAdminStats);
router.get('/catalog', getAdminCatalog);

// User Management & Premium Status
router.get('/users', getAdminUsers);
router.put('/users/:id/premium', toggleUserPremium);

// Movie & Content CRUD
router.post('/movies', createMovie);
router.put('/content/:id', updateContent);
router.delete('/content/:id', deleteContent);

// Series / Season / Episode CRUD
router.post('/series', createSeries);
router.post('/series/store-episodes', storeSeriesEpisodes);
router.post('/series/:seriesId/store-episodes', storeSeriesEpisodes);
router.post('/seasons', createSeason);
router.post('/episodes', createEpisode);

// User Content Requests Management
router.get('/requests', getAdminRequests);
router.put('/requests/:id', updateRequestStatus);
router.delete('/requests/:id', deleteRequest);

// Telegram Channel Import Workflow
router.get('/telegram/imports', getTelegramImports);
router.post('/telegram/sync', syncTelegramChannel);
router.post('/telegram/parse', parseTelegramPost);
router.post('/telegram/publish', publishTelegramImport);
router.post('/enrich', enrichCatalogMetadata);

// CineCoins Redemption Management
router.get('/redemptions', adminListRedemptions);
router.post('/redemptions/:id/approve', adminApproveRedemption);
router.post('/redemptions/:id/reject', adminRejectRedemption);
router.get('/coins/stats', adminCoinsStats);

export default router;
