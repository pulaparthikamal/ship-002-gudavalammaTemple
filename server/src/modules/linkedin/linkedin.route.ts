import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { LinkedInController } from './linkedin.controller';

const router = Router();

// GET /auth/linkedin?userId=<mongoId>  — start OAuth flow
router.get('/', asyncHandler((req, res) => LinkedInController.login(req, res)));

// GET /auth/linkedin/callback?code=...&state=<userId>  — OAuth callback
router.get('/callback', asyncHandler((req, res) => LinkedInController.callback(req, res)));

// GET /auth/linkedin/status?userId=<mongoId> — check if connected
router.get('/status', asyncHandler((req, res) => LinkedInController.getStatus(req, res)));

// DELETE /auth/linkedin/disconnect?userId=<mongoId> — disconnect account
router.delete('/disconnect', asyncHandler((req, res) => LinkedInController.disconnect(req, res)));

export default router;
