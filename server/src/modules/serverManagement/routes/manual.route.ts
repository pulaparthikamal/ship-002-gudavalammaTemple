import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { manualActionSchema } from '../server-management.schema';
import { manualController } from '../controllers/manual.controller';

const router = Router();

router.use(authMiddleware);
router.post('/action', validate(manualActionSchema), asyncHandler(manualController.action));

export default router;
