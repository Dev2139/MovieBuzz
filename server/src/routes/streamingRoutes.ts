import { Router } from 'express';
import {
  searchStreaming,
  getMovieSources,
  getSeriesSeasons,
  getSeriesSeasonsEpisodes,
  getEpisodeSources,
  resolveStreamingSources,
  proxyVideoStream,
  proxyEmbedStream,
  proxyEmbedSegment,
  diagnoseEmbedProviders,
  proxyDashStream,
  proxySubtitle,
  getSubtitles,
  getSubtitleFile,
} from '../controllers/streamingController';

const router = Router();

// Source resolution & searching
router.get('/search', searchStreaming);
router.get('/movies/:id/sources', getMovieSources);
router.get('/series/seasons-episodes', getSeriesSeasonsEpisodes);
router.get('/series/:id/seasons', getSeriesSeasons);
router.get('/episodes/:id/sources', getEpisodeSources);
router.get('/resolve', resolveStreamingSources);
router.get('/providers/diagnose', diagnoseEmbedProviders);

// Media & subtitle streaming proxies
router.get('/dash/:token/*', proxyDashStream);
router.get('/proxy', proxyVideoStream);
router.get('/embed-proxy', proxyEmbedStream);
router.get('/es/:token/*', proxyEmbedSegment);
router.get('/subtitle', proxySubtitle);
router.get('/subtitles', getSubtitles);
router.get('/subtitles/file', getSubtitleFile);

export default router;
