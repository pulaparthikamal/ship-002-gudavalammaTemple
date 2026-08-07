import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { logsAnalyticsQuerySchema, logsQuerySchema } from '../server-management.schema';
import { logsController } from '../controllers/logs.controller';

const router = Router();

router.use(authMiddleware);
router.get('/intelligence', asyncHandler(logsController.intelligence));
router.get('/query', validate(logsAnalyticsQuerySchema), asyncHandler(logsController.query));
router.get('/analytics', validate(logsAnalyticsQuerySchema), asyncHandler(logsController.analytics));
router.post('/intelligence/collect', asyncHandler(logsController.collect));
router.post('/intelligence/ingest', asyncHandler(logsController.ingest));
router.get('/intelligence/cleanup-recommendations', asyncHandler(logsController.cleanupRecommendations));
router.get('/intelligence/retention-policies', asyncHandler(logsController.retentionPolicies));
router.get('/', validate(logsQuerySchema), asyncHandler(logsController.list));

export default router;
