import { Router } from 'express';
import { codingReviewController } from './coding-review.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  approveCodingReviewSchema,
  createCodingReviewFromChargeSchema,
  createCodingReviewSchema,
  updateCodingReviewSchema,
} from './coding-review.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('coding-reviews', 'View'), asyncHandler(codingReviewController.list));
router.post(
  '/from-charge/:chargeId',
  permissionGuard('coding-reviews', 'Add'),
  validate(createCodingReviewFromChargeSchema),
  asyncHandler(codingReviewController.createFromCharge)
);
router.patch(
  '/:id/approve',
  permissionGuard('coding-reviews', 'Update'),
  validate(approveCodingReviewSchema),
  asyncHandler(codingReviewController.approve)
);
router.get('/:id', permissionGuard('coding-reviews', 'View'), asyncHandler(codingReviewController.getById));
router.post(
  '/',
  permissionGuard('coding-reviews', 'Add'),
  validate(createCodingReviewSchema),
  asyncHandler(codingReviewController.create)
);
router.put(
  '/:id',
  permissionGuard('coding-reviews', 'Update'),
  validate(updateCodingReviewSchema),
  asyncHandler(codingReviewController.update)
);
router.delete(
  '/:id',
  permissionGuard('coding-reviews', 'Delete'),
  asyncHandler(codingReviewController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('coding-reviews', 'Delete'),
  asyncHandler(codingReviewController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('coding-reviews', 'Update'),
  asyncHandler(codingReviewController.bulkUpdate)
);

export default router;
