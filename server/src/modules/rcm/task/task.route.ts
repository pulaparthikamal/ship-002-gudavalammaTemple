import { Router } from 'express';
import { taskController } from './task.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createTaskSchema, updateTaskSchema } from './task.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('tasks', 'View'), asyncHandler(taskController.list));
router.get('/:id', permissionGuard('tasks', 'View'), asyncHandler(taskController.getById));
router.post(
  '/',
  permissionGuard('tasks', 'Add'),
  validate(createTaskSchema),
  asyncHandler(taskController.create)
);
router.put(
  '/:id',
  permissionGuard('tasks', 'Update'),
  validate(updateTaskSchema),
  asyncHandler(taskController.update)
);
router.delete(
  '/:id',
  permissionGuard('tasks', 'Delete'),
  asyncHandler(taskController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('tasks', 'Delete'),
  asyncHandler(taskController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('tasks', 'Update'),
  asyncHandler(taskController.bulkUpdate)
);

export default router;
