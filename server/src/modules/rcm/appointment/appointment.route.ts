import { Router } from 'express';
import { appointmentController } from './appointment.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  bulkUpdateAppointmentSchema,
  checkInAppointmentSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
} from './appointment.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('appointments', 'View'), asyncHandler(appointmentController.list));
router.get('/summary', permissionGuard('appointments', 'View'), asyncHandler(appointmentController.summary));
router.patch(
  '/:id/check-in',
  permissionGuard('appointments', 'Update'),
  validate(checkInAppointmentSchema),
  asyncHandler(appointmentController.checkIn)
);
router.get('/:id', permissionGuard('appointments', 'View'), asyncHandler(appointmentController.getById));
router.post(
  '/',
  permissionGuard('appointments', 'Add'),
  validate(createAppointmentSchema),
  asyncHandler(appointmentController.create)
);
router.put(
  '/:id',
  permissionGuard('appointments', 'Update'),
  validate(updateAppointmentSchema),
  asyncHandler(appointmentController.update)
);
router.delete(
  '/:id',
  permissionGuard('appointments', 'Delete'),
  asyncHandler(appointmentController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('appointments', 'Delete'),
  asyncHandler(appointmentController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('appointments', 'Update'),
  validate(bulkUpdateAppointmentSchema),
  asyncHandler(appointmentController.bulkUpdate)
);

export default router;
