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
} from './user.schema';

const router = Router();

router.use(authMiddleware);

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
