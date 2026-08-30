import { Router } from 'express';
import { donorController } from './donor.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createDonorSchema, updateDonorSchema } from './donor.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('donor', 'View'), asyncHandler(donorController.list));
router.get('/:id', permissionGuard('donor', 'View'), asyncHandler(donorController.getById));
router.get('/:id/donations', permissionGuard('donor', 'View'), asyncHandler(donorController.getDonations));

router.post('/', permissionGuard('donor', 'Add'), validate(createDonorSchema), asyncHandler(donorController.create));
router.put('/:id', permissionGuard('donor', 'Update'), validate(updateDonorSchema), asyncHandler(donorController.update));
router.delete('/:id', permissionGuard('donor', 'Delete'), asyncHandler(donorController.delete));

// Bulk Operations
router.post('/bulk-delete', permissionGuard('donor', 'Delete'), asyncHandler(donorController.bulkDelete));
router.patch('/bulk-update', permissionGuard('donor', 'Update'), asyncHandler(donorController.bulkUpdate));

export default router;
