import { Router } from 'express';
import { priorAuthorizationController } from './prior-authorization.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createPriorAuthorizationSchema, updatePriorAuthorizationSchema } from './prior-authorization.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('prior-authorizations', 'View'), asyncHandler(priorAuthorizationController.list));
router.post('/:id/generate-packet', permissionGuard('prior-authorizations', 'Update'), asyncHandler(priorAuthorizationController.generatePacket));
router.post('/:id/submit-packet', permissionGuard('prior-authorizations', 'Update'), asyncHandler(priorAuthorizationController.submitPacket));
router.post('/:id/check-payer-status', permissionGuard('prior-authorizations', 'Update'), asyncHandler(priorAuthorizationController.checkPayerStatus));
router.get('/:id', permissionGuard('prior-authorizations', 'View'), asyncHandler(priorAuthorizationController.getById));
router.post(
  '/',
  permissionGuard('prior-authorizations', 'Add'),
  validate(createPriorAuthorizationSchema),
  asyncHandler(priorAuthorizationController.create)
);
router.put(
  '/:id',
  permissionGuard('prior-authorizations', 'Update'),
  validate(updatePriorAuthorizationSchema),
  asyncHandler(priorAuthorizationController.update)
);
router.delete(
  '/:id',
  permissionGuard('prior-authorizations', 'Delete'),
  asyncHandler(priorAuthorizationController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('prior-authorizations', 'Delete'),
  asyncHandler(priorAuthorizationController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('prior-authorizations', 'Update'),
  asyncHandler(priorAuthorizationController.bulkUpdate)
);

export default router;
