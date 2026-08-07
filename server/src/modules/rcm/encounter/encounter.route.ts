import { Router } from 'express';
import { encounterController } from './encounter.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  completeEncounterSchema,
  createEncounterSchema,
  suggestEncounterAiCodesSchema,
  updateEncounterSchema,
} from './encounter.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('encounters', 'View'), asyncHandler(encounterController.list));
router.patch(
  '/:id/complete',
  permissionGuard('encounters', 'Update'),
  validate(completeEncounterSchema),
  asyncHandler(encounterController.complete)
);
router.post(
  '/:id/ai-code-suggestions',
  permissionGuard('encounters', 'Update'),
  validate(suggestEncounterAiCodesSchema),
  asyncHandler(encounterController.suggestAiCodes)
);
router.get('/:id', permissionGuard('encounters', 'View'), asyncHandler(encounterController.getById));
router.post(
  '/',
  permissionGuard('encounters', 'Add'),
  validate(createEncounterSchema),
  asyncHandler(encounterController.create)
);
router.put(
  '/:id',
  permissionGuard('encounters', 'Update'),
  validate(updateEncounterSchema),
  asyncHandler(encounterController.update)
);
router.delete(
  '/:id',
  permissionGuard('encounters', 'Delete'),
  asyncHandler(encounterController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('encounters', 'Delete'),
  asyncHandler(encounterController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('encounters', 'Update'),
  asyncHandler(encounterController.bulkUpdate)
);

export default router;
