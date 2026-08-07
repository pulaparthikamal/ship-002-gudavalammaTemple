import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import {
  cleanupExecuteSchema,
  cleanupSummaryParamsSchema,
  serverIdQuerySchema,
} from '../server-management.schema';
import { cleanupController } from '../controllers/cleanup.controller';

const router = Router();

router.use(authMiddleware);
router.get('/timeline', validate(serverIdQuerySchema), asyncHandler(cleanupController.timeline));
router.get('/summary/:scanId', validate(cleanupSummaryParamsSchema), asyncHandler(cleanupController.summary));
router.post('/execute/:scanId', validate(cleanupExecuteSchema), asyncHandler(cleanupController.execute));

export default router;
