import { Router } from 'express';
import { menuController } from './menu.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleGuard, permissionGuard } from '../../middlewares/role.middleware';
import { RoleEnum } from '../../constants/roles.constants';
import { createMenuSchema, updateMenuSchema } from './menu.schema';

const router = Router();

router.use(authMiddleware);

// Any authenticated user
router.get('/', asyncHandler(menuController.getMyMenu));
router.get('/my-menu', asyncHandler(menuController.getMyMenu));

// ADMIN+
router.get('/flat', permissionGuard('menus', 'View'), asyncHandler(menuController.getFlatList));
router.get('/:id', permissionGuard('menus', 'View'), asyncHandler(menuController.getById));

// Modifications
router.post('/', permissionGuard('menus', 'Add'), validate(createMenuSchema), asyncHandler(menuController.create));
router.put('/:id', permissionGuard('menus', 'Update'), validate(updateMenuSchema), asyncHandler(menuController.update));
router.delete('/:id', permissionGuard('menus', 'Delete'), asyncHandler(menuController.delete));

// Bulk Operations
router.post('/bulk-delete', permissionGuard('menus', 'Delete'), asyncHandler(menuController.bulkDelete));
router.patch('/bulk-update', permissionGuard('menus', 'Update'), asyncHandler(menuController.bulkUpdate));

export default router;
