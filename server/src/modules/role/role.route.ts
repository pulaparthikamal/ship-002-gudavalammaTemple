import { Router } from 'express';
import { roleController } from './role.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleGuard, permissionGuard } from '../../middlewares/role.middleware';
import { RoleEnum } from '../../constants/roles.constants';
import { createRoleSchema, updateRoleSchema } from './role.schema';

const router = Router();

router.use(authMiddleware);

// Reading routes
router.get('/', permissionGuard('roles', 'View'), asyncHandler(roleController.list));
router.get('/:id', permissionGuard('roles', 'View'), asyncHandler(roleController.getById));

// Modifying routes
router.post('/', permissionGuard('roles', 'Add'), validate(createRoleSchema), asyncHandler(roleController.create));
router.put('/:id', permissionGuard('roles', 'Update'), validate(updateRoleSchema), asyncHandler(roleController.update));
router.delete('/:id', permissionGuard('roles', 'Delete'), asyncHandler(roleController.delete));

// Bulk Operations
router.post('/bulk-delete', permissionGuard('roles', 'Delete'), asyncHandler(roleController.bulkDelete));
router.patch('/bulk-update', permissionGuard('roles', 'Update'), asyncHandler(roleController.bulkUpdate));

export default router;
