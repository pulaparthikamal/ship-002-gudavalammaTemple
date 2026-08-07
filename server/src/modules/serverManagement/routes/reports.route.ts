import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { reportQuerySchema } from '../server-management.schema';
import { reportsController } from '../controllers/reports.controller';

const router = Router();

router.use(authMiddleware);
router.get('/', validate(reportQuerySchema), asyncHandler(reportsController.get));

export default router;
