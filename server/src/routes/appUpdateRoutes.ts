import { Router } from 'express';
import { getLatestAppUpdate } from '../controllers/appUpdateController';

const router = Router();

router.get('/latest', getLatestAppUpdate);

export default router;
