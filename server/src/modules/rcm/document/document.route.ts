import { Router } from 'express';
import { documentController } from './document.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createDocumentSchema, updateDocumentSchema, uploadDocumentFileSchema } from './document.schema';

const router = Router();

router.use(authMiddleware);

router.post(
  '/upload',
  validate(uploadDocumentFileSchema),
  asyncHandler(documentController.upload)
);
router.get('/', permissionGuard('documents', 'View'), asyncHandler(documentController.list));
router.get('/:id', permissionGuard('documents', 'View'), asyncHandler(documentController.getById));
router.post(
  '/',
  permissionGuard('documents', 'Add'),
  validate(createDocumentSchema),
  asyncHandler(documentController.create)
);
router.put(
  '/:id',
  permissionGuard('documents', 'Update'),
  validate(updateDocumentSchema),
  asyncHandler(documentController.update)
);
router.delete(
  '/:id',
  permissionGuard('documents', 'Delete'),
  asyncHandler(documentController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('documents', 'Delete'),
  asyncHandler(documentController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('documents', 'Update'),
  asyncHandler(documentController.bulkUpdate)
);

export default router;
