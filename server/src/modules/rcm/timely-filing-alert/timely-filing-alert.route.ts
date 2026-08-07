import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { timelyFilingAlertController } from './timely-filing-alert.controller';
import {
  refreshTimelyFilingAlertsSchema,
  timelyFilingAlertIdSchema,
} from './timely-filing-alert.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('claims', 'View'), asyncHandler(timelyFilingAlertController.list));
router.post(
  '/refresh',
  permissionGuard('claims', 'Update'),
  validate(refreshTimelyFilingAlertsSchema),
  asyncHandler(timelyFilingAlertController.refresh)
);
router.post(
  '/refresh-claim/:id',
  permissionGuard('claims', 'Update'),
  validate(timelyFilingAlertIdSchema),
  asyncHandler(timelyFilingAlertController.refreshClaim)
);
router.get(
  '/:id',
  permissionGuard('claims', 'View'),
  validate(timelyFilingAlertIdSchema),
  asyncHandler(timelyFilingAlertController.getById)
);

export default router;
