import { Router } from 'express';
import { announcementController } from './announcement.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createAnnouncementSchema, updateAnnouncementSchema } from './announcement.schema';

const router = Router();

// Public: active announcements feed (pre-login home page, no auth required).
router.get('/active', asyncHandler(announcementController.listActive));

// Staff-managed CRUD below.
router.use(authMiddleware);

router.get('/', permissionGuard('announcement', 'View'), asyncHandler(announcementController.list));
router.post('/', permissionGuard('announcement', 'Add'), validate(createAnnouncementSchema), asyncHandler(announcementController.create));
router.put('/:id', permissionGuard('announcement', 'Update'), validate(updateAnnouncementSchema), asyncHandler(announcementController.update));
router.delete('/:id', permissionGuard('announcement', 'Delete'), asyncHandler(announcementController.delete));

export default router;
