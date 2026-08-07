import { Router } from 'express';
import { denialController } from './denial.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  assignDenialOwnerSchema,
  changeDenialStatusSchema,
  createDenialSchema,
  denialReopenSchema,
  denialPreventableSchema,
  denialResolutionNotesSchema,
  updateDenialSchema,
} from './denial.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('denials', 'View'), asyncHandler(denialController.list));
router.get('/:id/recommendation', permissionGuard('denials', 'View'), asyncHandler(denialController.recommendation));
router.post('/:id/ai-analysis', permissionGuard('denials', 'Update'), asyncHandler(denialController.aiAnalysis));
router.patch('/:id/assign-owner', permissionGuard('denials', 'Update'), validate(assignDenialOwnerSchema), asyncHandler(denialController.assignOwner));
router.patch('/:id/status', permissionGuard('denials', 'Update'), validate(changeDenialStatusSchema), asyncHandler(denialController.changeStatus));
router.patch('/:id/resolution-notes', permissionGuard('denials', 'Update'), validate(denialResolutionNotesSchema), asyncHandler(denialController.addResolutionNotes));
router.patch('/:id/preventable', permissionGuard('denials', 'Update'), validate(denialPreventableSchema), asyncHandler(denialController.markPreventable));
router.post('/:id/ready-corrected-claim', permissionGuard('denials', 'Update'), asyncHandler(denialController.markReadyForCorrectedClaim));
router.post('/:id/ready-appeal', permissionGuard('denials', 'Update'), asyncHandler(denialController.markReadyForAppeal));
router.post('/:id/write-off', permissionGuard('denials', 'Update'), validate(denialResolutionNotesSchema), asyncHandler(denialController.writeOff));
router.post('/:id/transfer-to-patient', permissionGuard('denials', 'Update'), validate(denialResolutionNotesSchema), asyncHandler(denialController.transferToPatient));
router.post('/:id/reopen', permissionGuard('denials', 'Update'), validate(denialReopenSchema), asyncHandler(denialController.reopen));
router.get('/:id', permissionGuard('denials', 'View'), asyncHandler(denialController.getById));
router.post(
  '/',
  permissionGuard('denials', 'Add'),
  validate(createDenialSchema),
  asyncHandler(denialController.create)
);
router.put(
  '/:id',
  permissionGuard('denials', 'Update'),
  validate(updateDenialSchema),
  asyncHandler(denialController.update)
);
router.delete(
  '/:id',
  permissionGuard('denials', 'Delete'),
  asyncHandler(denialController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('denials', 'Delete'),
  asyncHandler(denialController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('denials', 'Update'),
  asyncHandler(denialController.bulkUpdate)
);

export default router;
