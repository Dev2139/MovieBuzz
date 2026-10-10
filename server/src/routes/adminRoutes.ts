import { Router } from 'express';
import {
  getAdminStats,
  getAdminCatalog,
  createMovie,
  createSeries,
  createSeason,
  createEpisode,
  updateContent,
  deleteContent,
  getTelegramImports,
  syncTelegramChannel,
  parseTelegramPost,
  publishTelegramImport,
  enrichCatalogMetadata,
} from '../controllers/adminController';
import {
  getAdminRequests,
  updateRequestStatus,
  deleteRequest,
} from '../controllers/requestController';
import { authenticate, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/stats', getAdminStats);
router.get('/catalog', getAdminCatalog);

// Movie & Content CRUD
router.post('/movies', createMovie);
router.put('/content/:id', updateContent);
router.delete('/content/:id', deleteContent);

// Series / Season / Episode CRUD
router.post('/series', createSeries);
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

export default router;
