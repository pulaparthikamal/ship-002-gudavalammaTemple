import { Router } from 'express';
import { ai835PayloadController } from './ai-835-payload.controller';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

// Fetch stored payloads by claimSubmissionId (returns null if not generated yet)
router.get(
  '/by-claim-submission/:claimSubmissionId',
  permissionGuard('era-eob-processings', 'View'),
  asyncHandler(ai835PayloadController.getByClaimSubmission)
);

// Generate (or regenerate) and persist payloads for a claim submission
router.post(
  '/generate',
  permissionGuard('era-eob-processings', 'View'),
  asyncHandler(ai835PayloadController.generateAndSave)
);

export default router;
