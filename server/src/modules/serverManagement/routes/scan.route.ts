import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import {
  cleanupRecommendationsSchema,
  manualActionSchema,
  scanResultsQuerySchema,
  startScanSchema,
} from '../server-management.schema';
import { manualController } from '../controllers/manual.controller';
import { scanController } from '../controllers/scan.controller';

const router = Router();

router.use(authMiddleware);
router.post('/start', validate(startScanSchema), asyncHandler(scanController.start));
router.post('/cleanup-recommendations', validate(cleanupRecommendationsSchema), asyncHandler(scanController.cleanupRecommendations));
router.get('/results', validate(scanResultsQuerySchema), asyncHandler(scanController.results));
router.post('/action', validate(manualActionSchema), asyncHandler(manualController.action));

export default router;
