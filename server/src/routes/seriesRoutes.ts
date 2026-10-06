import { Router } from 'express';
import { getSeriesSeasons, getSeasonEpisodes, getEpisodeById, getEpisodeByNumber } from '../controllers/seriesController';

const router = Router();

router.get('/series/:seriesId/seasons', getSeriesSeasons);
router.get('/seasons/:seasonId/episodes', getSeasonEpisodes);
router.get('/episodes/:episodeId', getEpisodeById);
router.get('/series-watch/:seriesSlug/:seasonNumber/:episodeNumber', getEpisodeByNumber);

export default router;
