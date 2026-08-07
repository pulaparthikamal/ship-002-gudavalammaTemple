import { Router } from 'express';
import { adjustmentController } from './adjustment.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createAdjustmentSchema, updateAdjustmentSchema } from './adjustment.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('adjustments', 'View'), asyncHandler(adjustmentController.list));
router.get('/:id', permissionGuard('adjustments', 'View'), asyncHandler(adjustmentController.getById));
router.post(
  '/',
  permissionGuard('adjustments', 'Add'),
  validate(createAdjustmentSchema),
  asyncHandler(adjustmentController.create)
);
router.put(
  '/:id',
  permissionGuard('adjustments', 'Update'),
  validate(updateAdjustmentSchema),
  asyncHandler(adjustmentController.update)
);
router.delete(
  '/:id',
  permissionGuard('adjustments', 'Delete'),
  asyncHandler(adjustmentController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('adjustments', 'Delete'),
  asyncHandler(adjustmentController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('adjustments', 'Update'),
  asyncHandler(adjustmentController.bulkUpdate)
);

export default router;
