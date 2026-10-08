import { Router } from 'express';
import { getContentList, getContentBySlug, getMovies, getSeries, getGenres, syncTelegramPosts, forceResyncTelegramPosts, diagnosticTelegramUpdates, debugTelegramImports, manualTelegramImport, handleTelegramWebhook } from '../controllers/contentController';

const router = Router();

router.get('/content', getContentList);
router.get('/content/:slug', getContentBySlug);
router.get('/movies', getMovies);
router.get('/movies/:slug', getContentBySlug);
router.get('/series', getSeries);
router.get('/series/:slug', getContentBySlug);
router.get('/genres', getGenres);
router.get('/sync', syncTelegramPosts);
router.get('/telegram/sync', syncTelegramPosts);
router.get('/telegram/force-sync', forceResyncTelegramPosts);
router.get('/telegram/diagnostic', diagnosticTelegramUpdates);
router.get('/telegram/debug-imports', debugTelegramImports);
router.post('/telegram/manual-import', manualTelegramImport);
router.post('/telegram/webhook', handleTelegramWebhook);
router.post('/webhook', handleTelegramWebhook);

export default router;
