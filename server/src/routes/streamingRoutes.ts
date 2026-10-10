import { Router } from 'express';
import {
  searchStreaming,
  getMovieSources,
  getSeriesSeasons,
  getEpisodeSources,
  resolveStreamingSources,
  proxyVideoStream,
  proxySubtitle,
} from '../controllers/streamingController';

const router = Router();

// Source resolution & searching
router.get('/search', searchStreaming);
router.get('/movies/:id/sources', getMovieSources);
router.get('/series/:id/seasons', getSeriesSeasons);
router.get('/episodes/:id/sources', getEpisodeSources);
router.get('/resolve', resolveStreamingSources);

// Media & subtitle streaming proxies
router.get('/proxy', proxyVideoStream);
router.get('/subtitle', proxySubtitle);

export default router;
