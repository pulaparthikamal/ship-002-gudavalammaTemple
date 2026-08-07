import { Router } from 'express';
import { refundController } from './refund.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createRefundSchema, refundActionSchema, updateRefundSchema } from './refund.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('refunds', 'View'), asyncHandler(refundController.list));
router.post(
  '/:id/actions/:action',
  permissionGuard('refunds', 'Update'),
  validate(refundActionSchema),
  asyncHandler(refundController.action)
);
router.get('/:id', permissionGuard('refunds', 'View'), asyncHandler(refundController.getById));
router.post(
  '/',
  permissionGuard('refunds', 'Add'),
  validate(createRefundSchema),
  asyncHandler(refundController.create)
);
router.put(
  '/:id',
  permissionGuard('refunds', 'Update'),
  validate(updateRefundSchema),
  asyncHandler(refundController.update)
);
router.delete(
  '/:id',
  permissionGuard('refunds', 'Delete'),
  asyncHandler(refundController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('refunds', 'Delete'),
  asyncHandler(refundController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('refunds', 'Update'),
  asyncHandler(refundController.bulkUpdate)
);

export default router;
