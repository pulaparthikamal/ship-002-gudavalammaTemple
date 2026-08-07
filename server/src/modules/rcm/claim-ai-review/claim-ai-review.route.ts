import { Router } from 'express';
import { claimAiReviewController } from './claim-ai-review.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createClaimAiReviewSchema, overrideClaimAiReviewSchema, updateClaimAiReviewSchema } from './claim-ai-review.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('claim-ai-reviews', 'View'), asyncHandler(claimAiReviewController.list));
router.get('/:id', permissionGuard('claim-ai-reviews', 'View'), asyncHandler(claimAiReviewController.getById));
router.post(
  '/:id/approve-override',
  permissionGuard('claim-ai-reviews', 'Update'),
  validate(overrideClaimAiReviewSchema),
  asyncHandler(claimAiReviewController.approveOverride)
);
router.post(
  '/',
  permissionGuard('claim-ai-reviews', 'Add'),
  validate(createClaimAiReviewSchema),
  asyncHandler(claimAiReviewController.create)
);
router.put(
  '/:id',
  permissionGuard('claim-ai-reviews', 'Update'),
  validate(updateClaimAiReviewSchema),
  asyncHandler(claimAiReviewController.update)
);
router.delete(
  '/:id',
  permissionGuard('claim-ai-reviews', 'Delete'),
  asyncHandler(claimAiReviewController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('claim-ai-reviews', 'Delete'),
  asyncHandler(claimAiReviewController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('claim-ai-reviews', 'Update'),
  asyncHandler(claimAiReviewController.bulkUpdate)
);

export default router;
