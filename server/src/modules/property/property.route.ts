import { Router } from 'express';
import { propertyController } from './property.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createPropertySchema, updatePropertySchema } from './property.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('property', 'View'), asyncHandler(propertyController.list));
router.get('/:id', permissionGuard('property', 'View'), asyncHandler(propertyController.getById));

router.post('/', permissionGuard('property', 'Add'), validate(createPropertySchema), asyncHandler(propertyController.create));
router.put('/:id', permissionGuard('property', 'Update'), validate(updatePropertySchema), asyncHandler(propertyController.update));
router.delete('/:id', permissionGuard('property', 'Delete'), asyncHandler(propertyController.delete));

// Bulk Operations
router.post('/bulk-delete', permissionGuard('property', 'Delete'), asyncHandler(propertyController.bulkDelete));
router.patch('/bulk-update', permissionGuard('property', 'Update'), asyncHandler(propertyController.bulkUpdate));

export default router;
