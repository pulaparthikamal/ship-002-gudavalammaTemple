import { Router } from 'express';
import { patientController } from './patient.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createPatientSchema, updatePatientSchema } from './patient.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('patients', 'View'), asyncHandler(patientController.list));
router.get('/:id/duplicate-candidates', permissionGuard('patients', 'View'), asyncHandler(patientController.duplicateCandidates));
router.post('/:id/mark-not-duplicate', permissionGuard('patients', 'Update'), asyncHandler(patientController.markNotDuplicate));
router.post('/merge-duplicates', permissionGuard('patients', 'Update'), asyncHandler(patientController.mergeDuplicate));
router.get('/:id', permissionGuard('patients', 'View'), asyncHandler(patientController.getById));
router.post(
  '/',
  permissionGuard('patients', 'Add'),
  validate(createPatientSchema),
  asyncHandler(patientController.create)
);
router.put(
  '/:id',
  permissionGuard('patients', 'Update'),
  validate(updatePatientSchema),
  asyncHandler(patientController.update)
);
router.delete(
  '/:id',
  permissionGuard('patients', 'Delete'),
  asyncHandler(patientController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('patients', 'Delete'),
  asyncHandler(patientController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('patients', 'Update'),
  asyncHandler(patientController.bulkUpdate)
);

export default router;
