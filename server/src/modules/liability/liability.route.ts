import { Router } from 'express';
import { liabilityController } from './liability.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createLiabilitySchema, updateLiabilitySchema } from './liability.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('liability', 'View'), asyncHandler(liabilityController.list));
router.get('/:id', permissionGuard('liability', 'View'), asyncHandler(liabilityController.getById));

router.post('/', permissionGuard('liability', 'Add'), validate(createLiabilitySchema), asyncHandler(liabilityController.create));
router.put('/:id', permissionGuard('liability', 'Update'), validate(updateLiabilitySchema), asyncHandler(liabilityController.update));
router.delete('/:id', permissionGuard('liability', 'Delete'), asyncHandler(liabilityController.delete));

// Bulk Operations
router.post('/bulk-delete', permissionGuard('liability', 'Delete'), asyncHandler(liabilityController.bulkDelete));
router.patch('/bulk-update', permissionGuard('liability', 'Update'), asyncHandler(liabilityController.bulkUpdate));

export default router;
