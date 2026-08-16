import { Router } from 'express';
import { assetController } from './asset.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createAssetSchema, updateAssetSchema } from './asset.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('asset', 'View'), asyncHandler(assetController.list));
router.get('/:id', permissionGuard('asset', 'View'), asyncHandler(assetController.getById));

router.post('/', permissionGuard('asset', 'Add'), validate(createAssetSchema), asyncHandler(assetController.create));
router.put('/:id', permissionGuard('asset', 'Update'), validate(updateAssetSchema), asyncHandler(assetController.update));
router.delete('/:id', permissionGuard('asset', 'Delete'), asyncHandler(assetController.delete));

// Bulk Operations
router.post('/bulk-delete', permissionGuard('asset', 'Delete'), asyncHandler(assetController.bulkDelete));
router.patch('/bulk-update', permissionGuard('asset', 'Update'), asyncHandler(assetController.bulkUpdate));

export default router;
