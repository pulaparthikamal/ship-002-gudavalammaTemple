import { Router } from 'express';
import { chargeMasterController } from './charge-master.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { createChargeMasterSchema, updateChargeMasterSchema } from './charge-master.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('charge-masters', 'View'), asyncHandler(chargeMasterController.list));
router.get('/:id', permissionGuard('charge-masters', 'View'), asyncHandler(chargeMasterController.getById));
router.post(
  '/',
  permissionGuard('charge-masters', 'Add'),
  validate(createChargeMasterSchema),
  asyncHandler(chargeMasterController.create)
);
router.put(
  '/:id',
  permissionGuard('charge-masters', 'Update'),
  validate(updateChargeMasterSchema),
  asyncHandler(chargeMasterController.update)
);
router.delete(
  '/:id',
  permissionGuard('charge-masters', 'Delete'),
  asyncHandler(chargeMasterController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('charge-masters', 'Delete'),
  asyncHandler(chargeMasterController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('charge-masters', 'Update'),
  asyncHandler(chargeMasterController.bulkUpdate)
);

export default router;
