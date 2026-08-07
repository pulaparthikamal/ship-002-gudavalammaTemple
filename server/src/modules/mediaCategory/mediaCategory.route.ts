import { Router } from 'express';
import { mediaCategoryController } from './mediaCategory.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import {
  createMediaCategorySchema,
  updateMediaCategorySchema,
  updateMediaCategoryStatusSchema,
  idParamSchema,
} from './mediaCategory.schema';


const router = Router();

router.use(authMiddleware);

router.post('/', permissionGuard('mediaCategories', 'Add'), validate(createMediaCategorySchema), asyncHandler(mediaCategoryController.create));
router.get('/', permissionGuard('mediaCategories', 'View'), asyncHandler(mediaCategoryController.list));
router.get('/:id', permissionGuard('mediaCategories', 'View'), validate(idParamSchema), asyncHandler(mediaCategoryController.getById));
router.put('/:id', permissionGuard('mediaCategories', 'Update'), validate(updateMediaCategorySchema), asyncHandler(mediaCategoryController.update));
router.delete('/:id', permissionGuard('mediaCategories', 'Delete'), validate(idParamSchema), asyncHandler(mediaCategoryController.delete));
router.patch('/:id/status', permissionGuard('mediaCategories', 'Update'), validate(updateMediaCategoryStatusSchema), asyncHandler(mediaCategoryController.toggleStatus));
router.post('/:id/generate', permissionGuard('mediaCategories', 'Update'), validate(idParamSchema), asyncHandler(mediaCategoryController.generateContent));


// Bulk Operations
router.post('/bulk-delete', permissionGuard('mediaCategories', 'Delete'), asyncHandler(mediaCategoryController.bulkDelete));
router.patch('/bulk-update', permissionGuard('mediaCategories', 'Update'), asyncHandler(mediaCategoryController.bulkUpdate));

export default router;
