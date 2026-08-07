import { Router } from 'express';
import { claimSubmissionController } from './claim-submission.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  ingestClaimAcknowledgementSchema,
  retryClaimSubmissionSchema,
} from './claim-submission.schema';
import { aiX12AckGeneratorService } from './ai-x12-ack-generator.service';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import respUtil from '../../../utils/resp.util';

const router = Router();

router.use(authMiddleware);

router.post(
  '/acknowledgements',
  permissionGuard('claim-submissions', 'Update'),
  validate(ingestClaimAcknowledgementSchema),
  asyncHandler(claimSubmissionController.ingestAcknowledgement)
);

router.get('/', permissionGuard('claim-submissions', 'View'), asyncHandler(claimSubmissionController.list));
router.post(
  '/x12-acknowledgements',
  permissionGuard('claim-submissions', 'Update'),
  asyncHandler(claimSubmissionController.ingestX12Acknowledgement)
);
router.post(
  '/generate-x12-ack',
  permissionGuard('claim-submissions', 'Update'),
  asyncHandler(async (req, res) => {
    const { claimId, claimSubmissionId } = req.body as { claimId?: string; claimSubmissionId?: string };
    if (!claimId || !claimSubmissionId) {
      throw new AppError('claimId and claimSubmissionId are required.', HTTP_STATUS.BAD_REQUEST);
    }
    const result = await aiX12AckGeneratorService.generateX12Ack(claimId, claimSubmissionId);
    res.json(respUtil.dataSuccessResponse(req, result));
  })
);
router.post(
  '/:id/retry',
  permissionGuard('claim-submissions', 'Update'),
  validate(retryClaimSubmissionSchema),
  asyncHandler(claimSubmissionController.retry)
);
router.get('/:id', permissionGuard('claim-submissions', 'View'), asyncHandler(claimSubmissionController.getById));

export default router;
