import { Router } from 'express';
import { settingsController } from './settings.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleGuard, permissionGuard } from '../../middlewares/role.middleware';
import { RoleEnum } from '../../constants/roles.constants';
import { createSettingSchema, updateSettingSchema } from './settings.schema';

const router = Router();

// Public route
router.get('/public', asyncHandler(settingsController.getPublic));

// Protected routes
router.use(authMiddleware);

// Protected routes
router.get('/', permissionGuard('settings', 'View'), asyncHandler(settingsController.list));
router.get('/:key', permissionGuard('settings', 'View'), asyncHandler(settingsController.getByKey));

// Modifications
router.post('/', permissionGuard('settings', 'Add'), validate(createSettingSchema), asyncHandler(settingsController.create));
router.put('/:key', permissionGuard('settings', 'Update'), validate(updateSettingSchema), asyncHandler(settingsController.update));
router.delete('/:key', permissionGuard('settings', 'Delete'), asyncHandler(settingsController.delete));

export default router;
