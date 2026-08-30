import { Router } from 'express';
import { sevaController } from './seva.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../../middlewares/optionalAuth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createSevaSchema, updateSevaSchema, createSevaBookingSchema } from './seva.schema';

const router = Router();

// Public: catalog browse — guests can see the seva list without logging in.
router.get('/', asyncHandler(sevaController.list));

// Staff catalog management
router.post('/', authMiddleware, permissionGuard('seva', 'Add'), validate(createSevaSchema), asyncHandler(sevaController.create));
router.put('/:id', authMiddleware, permissionGuard('seva', 'Update'), validate(updateSevaSchema), asyncHandler(sevaController.update));
router.delete('/:id', authMiddleware, permissionGuard('seva', 'Delete'), asyncHandler(sevaController.delete));

export default router;

// Mounted separately at /seva-bookings (see server/src/routes/index.ts).
export const sevaBookingRouter = Router();
sevaBookingRouter.use(optionalAuthMiddleware);
sevaBookingRouter.post('/', validate(createSevaBookingSchema), asyncHandler(sevaController.createBooking));
