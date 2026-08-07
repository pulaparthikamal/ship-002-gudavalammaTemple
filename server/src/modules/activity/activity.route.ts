import { Router } from 'express';
import { activityController } from './activity.controller';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleGuard, permissionGuard } from '../../middlewares/role.middleware';
import { RoleEnum } from '../../constants/roles.constants';

const router = Router();

router.use(authMiddleware);

// Admin can see all activities
router.get('/', permissionGuard('activities', 'View'), asyncHandler(activityController.list));

// Any user can see their own activities
router.get('/me', asyncHandler(activityController.getMyActivities));

export default router;
