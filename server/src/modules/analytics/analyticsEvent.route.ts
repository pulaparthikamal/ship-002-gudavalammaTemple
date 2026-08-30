import { Router } from 'express';
import { analyticsEventController } from './analyticsEvent.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../../middlewares/optionalAuth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { ingestEventsSchema, runRollupSchema } from './analyticsEvent.schema';

const router = Router();

// Public: the devotee frontend's trackEvent() beacon posts here, with or
// without a session (userId is attached when a valid token is present).
router.post('/events', optionalAuthMiddleware, validate(ingestEventsSchema), asyncHandler(analyticsEventController.ingest));

router.get('/summary', authMiddleware, permissionGuard('analytics', 'View'), asyncHandler(analyticsEventController.getSummary));
router.post(
  '/rollup/run',
  authMiddleware,
  permissionGuard('analytics', 'View'),
  validate(runRollupSchema),
  asyncHandler(analyticsEventController.runRollup)
);

export default router;
