import { Router } from 'express';
import { getMediaWatchStream, getMediaDownloadLink } from '../controllers/mediaController';

const router = Router();

router.get('/media/:mediaId/watch', getMediaWatchStream);
router.get('/media/:mediaId/download', getMediaDownloadLink);

export default router;
