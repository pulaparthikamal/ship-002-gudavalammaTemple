import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { rcmOpsController } from './rcm-ops.controller';

const router = Router();

router.use(authMiddleware);

router.get('/health', permissionGuard('dashboard', 'View'), asyncHandler(rcmOpsController.health));

export default router;
