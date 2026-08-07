import { Router } from 'express';
import { eligibilityVerificationController } from './eligibility-verification.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  createEligibilityVerificationSchema,
  runEligibilityVerificationSchema,
  updateEligibilityVerificationSchema,
} from './eligibility-verification.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('eligibility-verifications', 'View'), asyncHandler(eligibilityVerificationController.list));
router.get('/:id', permissionGuard('eligibility-verifications', 'View'), asyncHandler(eligibilityVerificationController.getById));
router.post(
  '/',
  permissionGuard('eligibility-verifications', 'Add'),
  validate(createEligibilityVerificationSchema),
  asyncHandler(eligibilityVerificationController.create)
);
router.post(
  '/run',
  permissionGuard('eligibility-verifications', 'Add'),
  validate(runEligibilityVerificationSchema),
  asyncHandler(eligibilityVerificationController.run)
);
router.put(
  '/:id',
  permissionGuard('eligibility-verifications', 'Update'),
  validate(updateEligibilityVerificationSchema),
  asyncHandler(eligibilityVerificationController.update)
);

export default router;
