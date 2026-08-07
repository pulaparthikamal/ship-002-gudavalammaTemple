import { Router } from 'express';
import { referralController } from './referral.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createReferralSchema, updateReferralSchema } from './referral.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('referrals', 'View'), asyncHandler(referralController.list));
router.get('/:id', permissionGuard('referrals', 'View'), asyncHandler(referralController.getById));
router.post(
  '/',
  permissionGuard('referrals', 'Add'),
  validate(createReferralSchema),
  asyncHandler(referralController.create)
);
router.put(
  '/:id',
  permissionGuard('referrals', 'Update'),
  validate(updateReferralSchema),
  asyncHandler(referralController.update)
);
router.delete(
  '/:id',
  permissionGuard('referrals', 'Delete'),
  asyncHandler(referralController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('referrals', 'Delete'),
  asyncHandler(referralController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('referrals', 'Update'),
  asyncHandler(referralController.bulkUpdate)
);

export default router;
