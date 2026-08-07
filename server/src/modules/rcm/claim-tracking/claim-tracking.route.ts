import { Router } from 'express';
import { claimTrackingController } from './claim-tracking.controller';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('claim-trackings', 'View'), asyncHandler(claimTrackingController.list));
router.post('/:id/analyze-rejection', permissionGuard('claim-trackings', 'Update'), asyncHandler(claimTrackingController.analyzeRejection));
router.get('/:id', permissionGuard('claim-trackings', 'View'), asyncHandler(claimTrackingController.getById));

export default router;
