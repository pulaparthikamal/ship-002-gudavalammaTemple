import { Router } from 'express';
import { patientPaymentController } from './patient-payment.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createPatientPaymentSchema, updatePatientPaymentSchema } from './patient-payment.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('patient-payments', 'View'), asyncHandler(patientPaymentController.list));
router.get('/:id', permissionGuard('patient-payments', 'View'), asyncHandler(patientPaymentController.getById));
router.post(
  '/',
  permissionGuard('patient-payments', 'Add'),
  validate(createPatientPaymentSchema),
  asyncHandler(patientPaymentController.create)
);
router.put(
  '/:id',
  permissionGuard('patient-payments', 'Update'),
  validate(updatePatientPaymentSchema),
  asyncHandler(patientPaymentController.update)
);
router.delete(
  '/:id',
  permissionGuard('patient-payments', 'Delete'),
  asyncHandler(patientPaymentController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('patient-payments', 'Delete'),
  asyncHandler(patientPaymentController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('patient-payments', 'Update'),
  asyncHandler(patientPaymentController.bulkUpdate)
);

export default router;
