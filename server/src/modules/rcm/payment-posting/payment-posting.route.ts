import { Router } from 'express';
import { paymentPostingController } from './payment-posting.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createPaymentPostingSchema, reversePaymentPostingSchema, updatePaymentPostingSchema } from './payment-posting.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('payment-postings', 'View'), asyncHandler(paymentPostingController.list));
router.get('/:id', permissionGuard('payment-postings', 'View'), asyncHandler(paymentPostingController.getById));
router.post(
  '/',
  permissionGuard('payment-postings', 'Add'),
  validate(createPaymentPostingSchema),
  asyncHandler(paymentPostingController.create)
);
router.put(
  '/:id',
  permissionGuard('payment-postings', 'Update'),
  validate(updatePaymentPostingSchema),
  asyncHandler(paymentPostingController.update)
);
router.post(
  '/:id/reverse',
  permissionGuard('payment-postings', 'Update'),
  validate(reversePaymentPostingSchema),
  asyncHandler(paymentPostingController.reverse)
);
router.delete(
  '/:id',
  permissionGuard('payment-postings', 'Delete'),
  asyncHandler(paymentPostingController.delete)
);
export default router;
