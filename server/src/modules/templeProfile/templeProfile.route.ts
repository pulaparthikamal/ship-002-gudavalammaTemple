import { Router } from 'express';
import { templeProfileController } from './templeProfile.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { updateTempleProfileSchema } from './templeProfile.schema';

const router = Router();

// Public: home page / devotee footer need this pre-login.
router.get('/', asyncHandler(templeProfileController.get));

router.put(
  '/',
  authMiddleware,
  permissionGuard('templeProfile', 'Update'),
  validate(updateTempleProfileSchema),
  asyncHandler(templeProfileController.update)
);

export default router;
