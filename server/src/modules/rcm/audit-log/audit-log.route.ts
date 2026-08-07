import { Router } from 'express';
import { auditLogController } from './audit-log.controller';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('audit-logs', 'View'), asyncHandler(auditLogController.list));
router.get('/export', permissionGuard('audit-logs', 'View'), asyncHandler(auditLogController.export));
router.get(
  '/summary/appointments',
  permissionGuard('audit-logs', 'View'),
  asyncHandler(auditLogController.getAppointmentSummaries)
);
router.get(
  '/summary/claims',
  permissionGuard('audit-logs', 'View'),
  asyncHandler(auditLogController.getClaimSummaries)
);
router.get(
  '/timeline/claim/:claimId',
  permissionGuard('audit-logs', 'View'),
  asyncHandler(auditLogController.getClaimTimeline)
);
router.get(
  '/timeline/appointment/:appointmentId',
  permissionGuard('audit-logs', 'View'),
  asyncHandler(auditLogController.getAppointmentTimeline)
);
router.get(
  '/entity/:entityType/:entityId',
  permissionGuard('audit-logs', 'View'),
  asyncHandler(auditLogController.getByEntity)
);
router.post('/', permissionGuard('audit-logs', 'Add'), asyncHandler(auditLogController.mutationNotAllowed));
router.post('/bulk-delete', permissionGuard('audit-logs', 'Delete'), asyncHandler(auditLogController.mutationNotAllowed));
router.patch('/bulk-update', permissionGuard('audit-logs', 'Update'), asyncHandler(auditLogController.mutationNotAllowed));
router.get('/:id', permissionGuard('audit-logs', 'View'), asyncHandler(auditLogController.getById));
router.put('/:id', permissionGuard('audit-logs', 'Update'), asyncHandler(auditLogController.mutationNotAllowed));
router.patch('/:id', permissionGuard('audit-logs', 'Update'), asyncHandler(auditLogController.mutationNotAllowed));
router.delete('/:id', permissionGuard('audit-logs', 'Delete'), asyncHandler(auditLogController.mutationNotAllowed));

export default router;
