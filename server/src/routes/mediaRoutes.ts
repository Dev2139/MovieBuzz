import { Router } from 'express';
import {
  getMediaWatchStream,
  getMediaDownloadLink,
  proxyTelegramFileStream,
  transcodeTelegramFileStream,
  downloadTelegramFile,
} from '../controllers/mediaController';

const router = Router();

router.get('/media/:mediaId/watch', getMediaWatchStream);
router.get('/media/:mediaId/download', getMediaDownloadLink);
router.get('/media/proxy-file/:fileId', proxyTelegramFileStream);
router.get('/media/transcode-stream/:fileId', transcodeTelegramFileStream);
router.get('/media/download-file/:fileId', downloadTelegramFile);

export default router;
