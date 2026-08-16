import { Router } from 'express';
import { donationController } from './donation.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../../middlewares/optionalAuth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createDonationSchema } from './donation.schema';

const router = Router();

router.get('/', authMiddleware, permissionGuard('donation', 'View'), asyncHandler(donationController.list));
router.post('/', optionalAuthMiddleware, validate(createDonationSchema), asyncHandler(donationController.create));
router.patch(
  '/:id/mark-paid',
  authMiddleware,
  permissionGuard('donation', 'Update'),
  asyncHandler(donationController.markPaid)
);

export default router;
