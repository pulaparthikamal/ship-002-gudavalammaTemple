import { Router } from 'express';
import { patientBillingController } from './patient-billing.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  createPatientBillingFromPostingSchema,
  createPatientBillingSchema,
  patientBillingActionSchema,
  updatePatientBillingSchema,
} from './patient-billing.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('patient-billings', 'View'), asyncHandler(patientBillingController.list));
router.post(
  '/from-payment-posting/:paymentPostingId',
  permissionGuard('patient-billings', 'Add'),
  validate(createPatientBillingFromPostingSchema),
  asyncHandler(patientBillingController.createFromPaymentPosting)
);
router.post(
  '/:id/actions/:action',
  permissionGuard('patient-billings', 'Update'),
  validate(patientBillingActionSchema),
  asyncHandler(patientBillingController.action)
);
router.get('/:id', permissionGuard('patient-billings', 'View'), asyncHandler(patientBillingController.getById));
router.post(
  '/',
  permissionGuard('patient-billings', 'Add'),
  validate(createPatientBillingSchema),
  asyncHandler(patientBillingController.create)
);
router.put(
  '/:id',
  permissionGuard('patient-billings', 'Update'),
  validate(updatePatientBillingSchema),
  asyncHandler(patientBillingController.update)
);
router.delete(
  '/:id',
  permissionGuard('patient-billings', 'Delete'),
  asyncHandler(patientBillingController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('patient-billings', 'Delete'),
  asyncHandler(patientBillingController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('patient-billings', 'Update'),
  asyncHandler(patientBillingController.bulkUpdate)
);

export default router;
