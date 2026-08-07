import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { commandCenterController } from './command-center.controller';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  permissionGuard('dashboard', 'View'),
  asyncHandler(commandCenterController.getSnapshot),
);

export default router;
