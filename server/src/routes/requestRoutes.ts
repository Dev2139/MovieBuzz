import { Router } from 'express';
import { createContentRequest } from '../controllers/requestController';

const router = Router();

// Public / Authenticated user endpoint to request a title
router.post('/', createContentRequest);

export default router;
