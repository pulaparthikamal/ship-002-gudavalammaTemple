import { Router } from 'express';
import { facilityController } from './facility.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createFacilitySchema, updateFacilitySchema } from './facility.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('facilities', 'View'), asyncHandler(facilityController.list));
router.get('/:id', permissionGuard('facilities', 'View'), asyncHandler(facilityController.getById));
router.post(
  '/',
  permissionGuard('facilities', 'Add'),
  validate(createFacilitySchema),
  asyncHandler(facilityController.create)
);
router.put(
  '/:id',
  permissionGuard('facilities', 'Update'),
  validate(updateFacilitySchema),
  asyncHandler(facilityController.update)
);
router.delete(
  '/:id',
  permissionGuard('facilities', 'Delete'),
  asyncHandler(facilityController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('facilities', 'Delete'),
  asyncHandler(facilityController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('facilities', 'Update'),
  asyncHandler(facilityController.bulkUpdate)
);

export default router;
