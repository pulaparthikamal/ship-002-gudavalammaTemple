import { Router } from 'express';
import { insurancePolicyController } from './insurance-policy.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createInsurancePolicySchema, updateInsurancePolicySchema } from './insurance-policy.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('insurance-policies', 'View'), asyncHandler(insurancePolicyController.list));
router.get('/:id', permissionGuard('insurance-policies', 'View'), asyncHandler(insurancePolicyController.getById));
router.post(
  '/',
  permissionGuard('insurance-policies', 'Add'),
  validate(createInsurancePolicySchema),
  asyncHandler(insurancePolicyController.create)
);
router.put(
  '/:id',
  permissionGuard('insurance-policies', 'Update'),
  validate(updateInsurancePolicySchema),
  asyncHandler(insurancePolicyController.update)
);
router.delete(
  '/:id',
  permissionGuard('insurance-policies', 'Delete'),
  asyncHandler(insurancePolicyController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('insurance-policies', 'Delete'),
  asyncHandler(insurancePolicyController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('insurance-policies', 'Update'),
  asyncHandler(insurancePolicyController.bulkUpdate)
);

export default router;
