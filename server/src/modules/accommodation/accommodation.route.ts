import { Router } from 'express';
import { accommodationController } from './accommodation.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../../middlewares/optionalAuth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import {
  createAccommodationRoomTypeSchema,
  updateAccommodationRoomTypeSchema,
  createAccommodationBookingSchema,
} from './accommodation.schema';

const roomTypeRouter = Router();

// Public: catalog browse — guests can see room types without logging in.
roomTypeRouter.get('/', asyncHandler(accommodationController.listRoomTypes));

// Staff-only catalog management.
roomTypeRouter.post(
  '/',
  authMiddleware,
  permissionGuard('accommodationRoomType', 'Add'),
  validate(createAccommodationRoomTypeSchema),
  asyncHandler(accommodationController.createRoomType)
);
roomTypeRouter.put(
  '/:id',
  authMiddleware,
  permissionGuard('accommodationRoomType', 'Update'),
  validate(updateAccommodationRoomTypeSchema),
  asyncHandler(accommodationController.updateRoomType)
);
roomTypeRouter.delete(
  '/:id',
  authMiddleware,
  permissionGuard('accommodationRoomType', 'Delete'),
  asyncHandler(accommodationController.deleteRoomType)
);

const bookingRouter = Router();

bookingRouter.use(optionalAuthMiddleware);

bookingRouter.post('/', validate(createAccommodationBookingSchema), asyncHandler(accommodationController.createBooking));

export const accommodationRoomTypeRoutes = roomTypeRouter;
export const accommodationBookingRoutes = bookingRouter;
