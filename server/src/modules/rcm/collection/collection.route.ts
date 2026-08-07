import { Router } from 'express';
import { collectionController } from './collection.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  collectionActionSchema,
  createCollectionSchema,
  generateCollectionsSchema,
  updateCollectionSchema,
} from './collection.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('collections', 'View'), asyncHandler(collectionController.list));
router.get('/rules', permissionGuard('collections', 'View'), asyncHandler(collectionController.rules));
router.post(
  '/generate',
  permissionGuard('collections', 'Add'),
  validate(generateCollectionsSchema),
  asyncHandler(collectionController.generate)
);
router.post(
  '/:id/actions/:action',
  permissionGuard('collections', 'Update'),
  validate(collectionActionSchema),
  asyncHandler(collectionController.action)
);
router.get('/:id', permissionGuard('collections', 'View'), asyncHandler(collectionController.getById));
router.post(
  '/',
  permissionGuard('collections', 'Add'),
  validate(createCollectionSchema),
  asyncHandler(collectionController.create)
);
router.put(
  '/:id',
  permissionGuard('collections', 'Update'),
  validate(updateCollectionSchema),
  asyncHandler(collectionController.update)
);
router.delete(
  '/:id',
  permissionGuard('collections', 'Delete'),
  asyncHandler(collectionController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('collections', 'Delete'),
  asyncHandler(collectionController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('collections', 'Update'),
  asyncHandler(collectionController.bulkUpdate)
);

export default router;
