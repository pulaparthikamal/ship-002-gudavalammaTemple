import { Router } from 'express';
import { correctedClaimController } from './corrected-claim.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  correctedClaimCorrectionsSchema,
  correctedClaimFromClaimSchema,
  correctedClaimFromDenialSchema,
  createCorrectedClaimSchema,
  updateCorrectedClaimSchema,
} from './corrected-claim.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('corrected-claims', 'View'), asyncHandler(correctedClaimController.list));
router.get('/claim/:claimId/lineage', permissionGuard('corrected-claims', 'View'), asyncHandler(correctedClaimController.lineage));
router.post('/from-claim/:claimId', permissionGuard('corrected-claims', 'Add'), validate(correctedClaimFromClaimSchema), asyncHandler(correctedClaimController.createFromClaim));
router.post('/from-denial/:denialId', permissionGuard('corrected-claims', 'Add'), validate(correctedClaimFromDenialSchema), asyncHandler(correctedClaimController.createFromDenial));
router.patch('/:id/corrections', permissionGuard('corrected-claims', 'Update'), validate(correctedClaimCorrectionsSchema), asyncHandler(correctedClaimController.applyCorrections));
router.get('/:id/readiness', permissionGuard('corrected-claims', 'View'), asyncHandler(correctedClaimController.readiness));
router.post('/:id/submit', permissionGuard('corrected-claims', 'Update'), asyncHandler(correctedClaimController.submit));
router.get('/:id', permissionGuard('corrected-claims', 'View'), asyncHandler(correctedClaimController.getById));
router.post(
  '/',
  permissionGuard('corrected-claims', 'Add'),
  validate(createCorrectedClaimSchema),
  asyncHandler(correctedClaimController.create)
);
router.put(
  '/:id',
  permissionGuard('corrected-claims', 'Update'),
  validate(updateCorrectedClaimSchema),
  asyncHandler(correctedClaimController.update)
);
router.delete(
  '/:id',
  permissionGuard('corrected-claims', 'Delete'),
  asyncHandler(correctedClaimController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('corrected-claims', 'Delete'),
  asyncHandler(correctedClaimController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('corrected-claims', 'Update'),
  asyncHandler(correctedClaimController.bulkUpdate)
);

export default router;
