import { Router } from 'express';
import { payerController } from './payer.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createPayerSchema, updatePayerSchema } from './payer.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('payers', 'View'), asyncHandler(payerController.list));
router.get('/:id', permissionGuard('payers', 'View'), asyncHandler(payerController.getById));
router.post(
  '/',
  permissionGuard('payers', 'Add'),
  validate(createPayerSchema),
  asyncHandler(payerController.create)
);
router.put(
  '/:id',
  permissionGuard('payers', 'Update'),
  validate(updatePayerSchema),
  asyncHandler(payerController.update)
);
router.delete(
  '/:id',
  permissionGuard('payers', 'Delete'),
  asyncHandler(payerController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('payers', 'Delete'),
  asyncHandler(payerController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('payers', 'Update'),
  asyncHandler(payerController.bulkUpdate)
);

export default router;
