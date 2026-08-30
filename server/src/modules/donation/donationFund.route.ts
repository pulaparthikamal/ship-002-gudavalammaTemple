import { Router } from 'express';
import { donationController } from './donation.controller';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createDonationFundSchema, updateDonationFundSchema } from './donationFund.schema';

const router = Router();

// Public: catalog browse — guests can see donation funds without logging in.
router.get('/', asyncHandler(donationController.listFunds));

// Staff fund management
router.post('/', authMiddleware, permissionGuard('donationFund', 'Add'), validate(createDonationFundSchema), asyncHandler(donationController.createFund));
router.put('/:id', authMiddleware, permissionGuard('donationFund', 'Update'), validate(updateDonationFundSchema), asyncHandler(donationController.updateFund));
router.delete('/:id', authMiddleware, permissionGuard('donationFund', 'Delete'), asyncHandler(donationController.deleteFund));

export default router;
