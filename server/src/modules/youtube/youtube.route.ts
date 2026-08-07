import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { YouTubeController } from './youtube.controller';

const router = Router();

// GET /auth/youtube?userId=<mongoId>
router.get('/', asyncHandler((req, res) => YouTubeController.login(req, res)));

// GET /auth/youtube/callback?code=...&state=<userId>
router.get('/callback', asyncHandler((req, res) => YouTubeController.callback(req, res)));

// GET /auth/youtube/status?userId=<mongoId>
router.get('/status', asyncHandler((req, res) => YouTubeController.getStatus(req, res)));

// DELETE /auth/youtube/disconnect?userId=<mongoId>
router.delete('/disconnect', asyncHandler((req, res) => YouTubeController.disconnect(req, res)));

export default router;
