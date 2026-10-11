import { Router } from 'express';
import {
  searchStreaming,
  getMovieSources,
  getSeriesSeasons,
  getSeriesSeasonsEpisodes,
  getEpisodeSources,
  resolveStreamingSources,
  proxyVideoStream,
  proxyDashStream,
  proxySubtitle,
} from '../controllers/streamingController';

const router = Router();

// Source resolution & searching
router.get('/search', searchStreaming);
router.get('/movies/:id/sources', getMovieSources);
router.get('/series/seasons-episodes', getSeriesSeasonsEpisodes);
router.get('/series/:id/seasons', getSeriesSeasons);
router.get('/episodes/:id/sources', getEpisodeSources);
router.get('/resolve', resolveStreamingSources);

// Media & subtitle streaming proxies
router.get('/dash/:token/*', proxyDashStream);
router.get('/proxy', proxyVideoStream);
router.get('/subtitle', proxySubtitle);

export default router;
