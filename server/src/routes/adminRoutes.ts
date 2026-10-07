import { Router } from 'express';
import {
  getAdminStats,
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
import { authenticate, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/stats', getAdminStats);

// Movie & Content CRUD
router.post('/movies', createMovie);
router.put('/content/:id', updateContent);
router.delete('/content/:id', deleteContent);

// Series / Season / Episode CRUD
router.post('/series', createSeries);
router.post('/seasons', createSeason);
router.post('/episodes', createEpisode);

// Telegram Channel Import Workflow
router.get('/telegram/imports', getTelegramImports);
router.post('/telegram/sync', syncTelegramChannel);
router.post('/telegram/parse', parseTelegramPost);
router.post('/telegram/publish', publishTelegramImport);
router.post('/enrich', enrichCatalogMetadata);

export default router;
