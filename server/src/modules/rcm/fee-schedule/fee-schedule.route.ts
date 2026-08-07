import { Router } from 'express';
import { feeScheduleController } from './fee-schedule.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';

const router = Router();

router.use(authMiddleware);

router.post('/lookup', permissionGuard('fee-schedules', 'View'), asyncHandler(feeScheduleController.lookup));
router.post('/', permissionGuard('fee-schedules', 'Add'), asyncHandler(feeScheduleController.create));
router.get('/', permissionGuard('fee-schedules', 'View'), asyncHandler(feeScheduleController.list));
router.get('/:id', permissionGuard('fee-schedules', 'View'), asyncHandler(feeScheduleController.getById));
router.put('/:id', permissionGuard('fee-schedules', 'Update'), asyncHandler(feeScheduleController.update));
router.delete('/:id', permissionGuard('fee-schedules', 'Delete'), asyncHandler(feeScheduleController.delete));

export default router;
