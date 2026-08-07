import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { logsQuerySchema } from '../server-management.schema';
import { alertsController } from '../controllers/alerts.controller';

const router = Router();

router.use(authMiddleware);
router.get('/', validate(logsQuerySchema), asyncHandler(alertsController.list));

export default router;
