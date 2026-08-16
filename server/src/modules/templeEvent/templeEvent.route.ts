import { Router } from 'express';
import { templeEventController } from './templeEvent.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../../middlewares/optionalAuth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createTempleEventSchema, updateTempleEventSchema, createEventRegistrationSchema } from './templeEvent.schema';

const router = Router();

// Public: guests and devotees can browse upcoming events without logging in.
router.get('/', asyncHandler(templeEventController.list));

router.post('/', authMiddleware, permissionGuard('templeEvent', 'Add'), validate(createTempleEventSchema), asyncHandler(templeEventController.create));
router.put('/:id', authMiddleware, permissionGuard('templeEvent', 'Update'), validate(updateTempleEventSchema), asyncHandler(templeEventController.update));
router.delete('/:id', authMiddleware, permissionGuard('templeEvent', 'Delete'), asyncHandler(templeEventController.delete));
router.get('/:eventId/registrations', authMiddleware, permissionGuard('templeEvent', 'View'), asyncHandler(templeEventController.listRegistrations));

export default router;

// Mounted separately at /event-registrations (see server/src/routes/index.ts).
export const eventRegistrationRouter = Router();
eventRegistrationRouter.get('/mine', authMiddleware, asyncHandler(templeEventController.listMyRegistrations));
eventRegistrationRouter.post('/', optionalAuthMiddleware, validate(createEventRegistrationSchema), asyncHandler(templeEventController.register));
