import { Router } from 'express';
import { nearbyPlaceController } from './nearbyPlace.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createNearbyPlaceSchema, updateNearbyPlaceSchema } from './nearbyPlace.schema';

const router = Router();

// Public: devotees browse must-visit nearby places without logging in.
router.get('/', asyncHandler(nearbyPlaceController.list));

router.post('/', authMiddleware, permissionGuard('nearbyPlace', 'Add'), validate(createNearbyPlaceSchema), asyncHandler(nearbyPlaceController.create));
router.put('/:id', authMiddleware, permissionGuard('nearbyPlace', 'Update'), validate(updateNearbyPlaceSchema), asyncHandler(nearbyPlaceController.update));
router.delete('/:id', authMiddleware, permissionGuard('nearbyPlace', 'Delete'), asyncHandler(nearbyPlaceController.delete));

export default router;
