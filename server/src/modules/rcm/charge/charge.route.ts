import { Router } from 'express';
import { chargeController } from './charge.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  createChargeFromEncounterSchema,
  createChargeSchema,
  submitChargeForReviewSchema,
  updateChargeSchema,
} from './charge.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('charges', 'View'), asyncHandler(chargeController.list));
router.post(
  '/from-encounter/:encounterId',
  permissionGuard('charges', 'Add'),
  validate(createChargeFromEncounterSchema),
  asyncHandler(chargeController.createFromEncounter)
);
router.patch(
  '/:id/submit-review',
  permissionGuard('charges', 'Update'),
  validate(submitChargeForReviewSchema),
  asyncHandler(chargeController.submitReview)
);
router.get('/:id', permissionGuard('charges', 'View'), asyncHandler(chargeController.getById));
router.post(
  '/',
  permissionGuard('charges', 'Add'),
  validate(createChargeSchema),
  asyncHandler(chargeController.create)
);
router.put(
  '/:id',
  permissionGuard('charges', 'Update'),
  validate(updateChargeSchema),
  asyncHandler(chargeController.update)
);
router.delete(
  '/:id',
  permissionGuard('charges', 'Delete'),
  asyncHandler(chargeController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('charges', 'Delete'),
  asyncHandler(chargeController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('charges', 'Update'),
  asyncHandler(chargeController.bulkUpdate)
);

export default router;
