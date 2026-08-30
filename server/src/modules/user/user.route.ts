import { Router } from 'express';
import { userController } from './user.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleGuard, permissionGuard } from '../../middlewares/role.middleware';
import { RoleEnum } from '../../constants/roles.constants';
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  updateOwnLocaleSchema,
  updateOwnProfileSchema,
} from './user.schema';

const router = Router();

router.use(authMiddleware);

// Self-service: update the current user's own preferred locale.
router.patch('/me/locale', validate(updateOwnLocaleSchema), asyncHandler(userController.updateOwnLocale));

// Self-service: update the current user's own profile (name/email/phone only).
router.patch('/me', validate(updateOwnProfileSchema), asyncHandler(userController.updateOwnProfile));

// Delete remains SUPER_ADMIN only, or we could use permissionGuard('users', 'Delete')
router.delete('/:id', permissionGuard('users', 'Delete'), asyncHandler(userController.delete));

router.post('/', permissionGuard('users', 'Add'), validate(createUserSchema), asyncHandler(userController.create));
router.get('/', permissionGuard('users', 'View'), asyncHandler(userController.list));
router.get('/:id', permissionGuard('users', 'View'), asyncHandler(userController.getById));
router.put('/:id', permissionGuard('users', 'Update'), validate(updateUserSchema), asyncHandler(userController.update));
router.patch('/:id/status', permissionGuard('users', 'Update'), validate(updateUserStatusSchema), asyncHandler(userController.toggleStatus));

// Bulk Operations
router.post('/bulk-delete', permissionGuard('users', 'Delete'), asyncHandler(userController.bulkDelete));
router.patch('/bulk-update', permissionGuard('users', 'Update'), asyncHandler(userController.bulkUpdate));

export default router;
