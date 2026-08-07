import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleGuard, permissionGuard } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createDashboardSchema, updateDashboardSchema } from './dashboard.schema';
import { RoleEnum } from '../../constants/roles.constants';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('dashboard', 'View'), dashboardController.getAll);
router.get('/:id', permissionGuard('dashboard', 'View'), dashboardController.getById);

router.post(
  '/',
  permissionGuard('dashboard', 'Add'),
  validate(createDashboardSchema),
  dashboardController.create
);

router.patch(
  '/:id',
  permissionGuard('dashboard', 'Update'),
  validate(updateDashboardSchema),
  dashboardController.update
);

router.delete('/:id', permissionGuard('dashboard', 'Delete'), dashboardController.delete);

export default router;
