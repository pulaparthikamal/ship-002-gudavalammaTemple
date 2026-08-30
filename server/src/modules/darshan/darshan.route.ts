import { Router } from 'express';
import { darshanController } from './darshan.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../../middlewares/optionalAuth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createDarshanQuotaSchema, updateDarshanQuotaSchema, createDarshanBookingSchema } from './darshan.schema';

const router = Router();

// Public: catalog browse — guests can see darshan quotas without logging in.
router.get('/', asyncHandler(darshanController.list));

// Staff catalog management — still requires auth + permission.
router.post('/', authMiddleware, permissionGuard('darshan', 'Add'), validate(createDarshanQuotaSchema), asyncHandler(darshanController.create));
router.put('/:id', authMiddleware, permissionGuard('darshan', 'Update'), validate(updateDarshanQuotaSchema), asyncHandler(darshanController.update));
router.delete('/:id', authMiddleware, permissionGuard('darshan', 'Delete'), asyncHandler(darshanController.delete));

export default router;

// Mounted separately at /darshan-bookings (see server/src/routes/index.ts).
// Guest checkout: optionalAuthMiddleware populates req.user if a valid
// token is present, but never rejects an anonymous request.
export const darshanBookingRouter = Router();
darshanBookingRouter.use(optionalAuthMiddleware);
darshanBookingRouter.post('/', validate(createDarshanBookingSchema), asyncHandler(darshanController.createBooking));
