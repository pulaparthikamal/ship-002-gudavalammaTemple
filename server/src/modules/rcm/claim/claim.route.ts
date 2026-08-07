import { Router } from 'express';
import { claimController } from './claim.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  createClaimFromChargeSchema,
  createClaimSchema,
  claimAiReadinessReviewSchema,
  claimAiRejectionAnalysisSchema,
  claimReadinessSchema,
  claimStatusInquirySchema,
  closeClaimSchema,
  linkClaimAuthorizationSchema,
  linkClaimReferralSchema,
  predictClaimDenialSchema,
  refreshClaimStatusSchema,
  refreshClaimPricingSchema,
  reopenClaimSchema,
  resubmitClaimSchema,
  runClaimEligibilitySchema,
  scrubClaimSchema,
  submitClaimSchema,
  updateClaimSchema,
} from './claim.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('claims', 'View'), asyncHandler(claimController.list));
router.get('/rejected', permissionGuard('claims', 'View'), asyncHandler(claimController.listRejected));
router.post(
  '/predict-denial',
  permissionGuard('claims', 'View'),
  validate(predictClaimDenialSchema),
  asyncHandler(claimController.predictDenial)
);
router.post(
  '/from-charge/:chargeId',
  permissionGuard('claims', 'Add'),
  validate(createClaimFromChargeSchema),
  asyncHandler(claimController.createFromCharge)
);
router.get('/:id', permissionGuard('claims', 'View'), asyncHandler(claimController.getById));
router.get(
  '/:id/rejections',
  permissionGuard('claims', 'View'),
  asyncHandler(claimController.getRejections)
);
router.post(
  '/',
  permissionGuard('claims', 'Add'),
  validate(createClaimSchema),
  asyncHandler(claimController.create)
);
router.put(
  '/:id',
  permissionGuard('claims', 'Update'),
  validate(updateClaimSchema),
  asyncHandler(claimController.update)
);
router.post(
  '/:id/ai-analysis',
  permissionGuard('claims', 'View'),
  validate(claimAiRejectionAnalysisSchema),
  asyncHandler(claimController.aiAnalysis)
);
router.post(
  '/:id/resubmit',
  permissionGuard('claims', 'Update'),
  validate(resubmitClaimSchema),
  asyncHandler(claimController.resubmit)
);
router.post(
  '/:id/readiness',
  permissionGuard('claims', 'View'),
  validate(claimReadinessSchema),
  asyncHandler(claimController.readiness)
);
router.get(
  '/:id/status',
  permissionGuard('claims', 'View'),
  validate(claimStatusInquirySchema),
  asyncHandler(claimController.status)
);
router.get(
  '/:id/closure',
  permissionGuard('claims', 'View'),
  asyncHandler(claimController.evaluateClosure)
);
router.get(
  '/:id/closure-snapshots',
  permissionGuard('claims', 'View'),
  asyncHandler(claimController.listClosureSnapshots)
);
router.post(
  '/:id/close',
  permissionGuard('claims', 'Update'),
  validate(closeClaimSchema),
  asyncHandler(claimController.close)
);
router.post(
  '/:id/reopen',
  permissionGuard('claims', 'Update'),
  validate(reopenClaimSchema),
  asyncHandler(claimController.reopen)
);
router.post(
  '/:id/refresh-status',
  permissionGuard('claims', 'Update'),
  validate(refreshClaimStatusSchema),
  asyncHandler(claimController.refreshStatus)
);
router.post(
  '/:id/ai-readiness-review',
  permissionGuard('claims', 'View'),
  validate(claimAiReadinessReviewSchema),
  asyncHandler(claimController.aiReadinessReview)
);
router.post(
  '/:id/run-eligibility',
  permissionGuard('claims', 'Update'),
  validate(runClaimEligibilitySchema),
  asyncHandler(claimController.runEligibility)
);
router.post(
  '/:id/refresh-pricing',
  permissionGuard('claims', 'Update'),
  validate(refreshClaimPricingSchema),
  asyncHandler(claimController.refreshPricing)
);
router.post(
  '/:id/link-authorization',
  permissionGuard('claims', 'Update'),
  validate(linkClaimAuthorizationSchema),
  asyncHandler(claimController.linkAuthorization)
);
router.post(
  '/:id/link-referral',
  permissionGuard('claims', 'Update'),
  validate(linkClaimReferralSchema),
  asyncHandler(claimController.linkReferral)
);
router.patch(
  '/:id/submit',
  permissionGuard('claims', 'Update'),
  validate(submitClaimSchema),
  asyncHandler(claimController.submit)
);
router.post(
  '/:id/scrub',
  permissionGuard('claims', 'View'),
  validate(scrubClaimSchema),
  asyncHandler(claimController.scrub)
);
router.delete(
  '/:id',
  permissionGuard('claims', 'Delete'),
  asyncHandler(claimController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('claims', 'Delete'),
  asyncHandler(claimController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('claims', 'Update'),
  asyncHandler(claimController.bulkUpdate)
);

export default router;
