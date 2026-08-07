import { Router } from 'express';
import { eraEobProcessingController } from './era-eob-processing.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  createEraEobProcessingSchema,
  import835Schema,
  lockEraEobProcessingSchema,
  replayEraEobProcessingSchema,
  unlockEraEobProcessingSchema,
  updateEraEobProcessingSchema,
} from './era-eob-processing.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('era-eob-processings', 'View'), asyncHandler(eraEobProcessingController.list));
router.post(
  '/import-835',
  permissionGuard('era-eob-processings', 'Add'),
  validate(import835Schema),
  asyncHandler(eraEobProcessingController.import835)
);
router.post(
  '/:id/lock',
  permissionGuard('era-eob-processings', 'Update'),
  validate(lockEraEobProcessingSchema),
  asyncHandler(eraEobProcessingController.lockAccounting)
);
router.post(
  '/:id/unlock',
  permissionGuard('era-eob-processings', 'Update'),
  validate(unlockEraEobProcessingSchema),
  asyncHandler(eraEobProcessingController.unlockAccounting)
);
router.post(
  '/:id/replay',
  permissionGuard('era-eob-processings', 'Update'),
  validate(replayEraEobProcessingSchema),
  asyncHandler(eraEobProcessingController.replay)
);
router.get('/:id', permissionGuard('era-eob-processings', 'View'), asyncHandler(eraEobProcessingController.getById));
router.post(
  '/',
  permissionGuard('era-eob-processings', 'Add'),
  validate(createEraEobProcessingSchema),
  asyncHandler(eraEobProcessingController.create)
);
router.put(
  '/:id',
  permissionGuard('era-eob-processings', 'Update'),
  validate(updateEraEobProcessingSchema),
  asyncHandler(eraEobProcessingController.update)
);
router.delete(
  '/:id',
  permissionGuard('era-eob-processings', 'Delete'),
  asyncHandler(eraEobProcessingController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('era-eob-processings', 'Delete'),
  asyncHandler(eraEobProcessingController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('era-eob-processings', 'Update'),
  asyncHandler(eraEobProcessingController.bulkUpdate)
);

export default router;
