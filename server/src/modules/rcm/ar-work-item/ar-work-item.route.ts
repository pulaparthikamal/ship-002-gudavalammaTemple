import { Router } from 'express';
import { arWorkItemController } from './ar-work-item.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  arWorkItemContactSchema,
  arWorkItemStatusSchema,
  createArWorkItemSchema,
  generateArWorkItemsSchema,
  updateArWorkItemSchema,
} from './ar-work-item.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('ar-work-items', 'View'), asyncHandler(arWorkItemController.list));
router.post(
  '/generate',
  permissionGuard('ar-work-items', 'Add'),
  validate(generateArWorkItemsSchema),
  asyncHandler(arWorkItemController.generate)
);
router.patch(
  '/:id/status',
  permissionGuard('ar-work-items', 'Update'),
  validate(arWorkItemStatusSchema),
  asyncHandler(arWorkItemController.changeStatus)
);
router.post(
  '/:id/contact-history',
  permissionGuard('ar-work-items', 'Update'),
  validate(arWorkItemContactSchema),
  asyncHandler(arWorkItemController.addContact)
);
router.post(
  '/:id/ai-prioritize',
  permissionGuard('ar-work-items', 'Update'),
  asyncHandler(arWorkItemController.aiPrioritize)
);
router.get('/:id', permissionGuard('ar-work-items', 'View'), asyncHandler(arWorkItemController.getById));
router.post(
  '/',
  permissionGuard('ar-work-items', 'Add'),
  validate(createArWorkItemSchema),
  asyncHandler(arWorkItemController.create)
);
router.put(
  '/:id',
  permissionGuard('ar-work-items', 'Update'),
  validate(updateArWorkItemSchema),
  asyncHandler(arWorkItemController.update)
);
router.delete(
  '/:id',
  permissionGuard('ar-work-items', 'Delete'),
  asyncHandler(arWorkItemController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('ar-work-items', 'Delete'),
  asyncHandler(arWorkItemController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('ar-work-items', 'Update'),
  asyncHandler(arWorkItemController.bulkUpdate)
);

export default router;
