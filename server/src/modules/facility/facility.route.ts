import { Router } from 'express';
import { facilityController } from './facility.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createFacilitySchema, updateFacilitySchema } from './facility.schema';

const router = Router();

// Public: active facilities list (devotee-facing, no auth required).
router.get('/', asyncHandler(facilityController.list));

// Staff-managed CRUD below.
router.use(authMiddleware);

router.get('/all', permissionGuard('facility', 'View'), asyncHandler(facilityController.listAll));
router.post('/', permissionGuard('facility', 'Add'), validate(createFacilitySchema), asyncHandler(facilityController.create));
router.put('/:id', permissionGuard('facility', 'Update'), validate(updateFacilitySchema), asyncHandler(facilityController.update));
router.delete('/:id', permissionGuard('facility', 'Delete'), asyncHandler(facilityController.delete));

export default router;
