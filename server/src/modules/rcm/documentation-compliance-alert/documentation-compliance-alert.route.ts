import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { documentationComplianceAlertController } from './documentation-compliance-alert.controller';
import {
  documentationComplianceAlertIdSchema,
  refreshDocumentationComplianceAlertsSchema,
} from './documentation-compliance-alert.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('claims', 'View'), asyncHandler(documentationComplianceAlertController.list));
router.post(
  '/refresh',
  permissionGuard('claims', 'Update'),
  validate(refreshDocumentationComplianceAlertsSchema),
  asyncHandler(documentationComplianceAlertController.refresh)
);
router.post(
  '/refresh-claim/:id',
  permissionGuard('claims', 'Update'),
  validate(documentationComplianceAlertIdSchema),
  asyncHandler(documentationComplianceAlertController.refreshClaim)
);
router.get(
  '/:id',
  permissionGuard('claims', 'View'),
  validate(documentationComplianceAlertIdSchema),
  asyncHandler(documentationComplianceAlertController.getById)
);

export default router;
