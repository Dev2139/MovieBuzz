import { Router } from 'express';
import {
  createContentRequest,
  getRequestLeaderboard,
  voteRequest,
} from '../controllers/requestController';
import { authenticate, optionalAuth } from '../middleware/authMiddleware';

const router = Router();

// Public / Authenticated user endpoint to request a title
// (optionalAuth so duplicate requests merge into community votes)
router.post('/', optionalAuth, createContentRequest);

// Public community requests leaderboard (auth optional → shows hasVoted/isMine)
router.get('/leaderboard', optionalAuth, getRequestLeaderboard);

// Toggle "me too" vote on a pending request
router.post('/:id/vote', authenticate, voteRequest);

export default router;
