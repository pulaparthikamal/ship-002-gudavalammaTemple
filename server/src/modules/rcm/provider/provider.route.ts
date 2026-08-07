import { Router } from 'express';
import { providerController } from './provider.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createProviderSchema, updateProviderSchema } from './provider.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('providers', 'View'), asyncHandler(providerController.list));
router.get('/:id', permissionGuard('providers', 'View'), asyncHandler(providerController.getById));
router.post(
  '/',
  permissionGuard('providers', 'Add'),
  validate(createProviderSchema),
  asyncHandler(providerController.create)
);
router.put(
  '/:id',
  permissionGuard('providers', 'Update'),
  validate(updateProviderSchema),
  asyncHandler(providerController.update)
);
router.delete(
  '/:id',
  permissionGuard('providers', 'Delete'),
  asyncHandler(providerController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('providers', 'Delete'),
  asyncHandler(providerController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('providers', 'Update'),
  asyncHandler(providerController.bulkUpdate)
);

export default router;
