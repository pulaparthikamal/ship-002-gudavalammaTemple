import { Router } from 'express';
import { navTabController } from './navTab.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../../middlewares/optionalAuth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { setNavTabRolesSchema } from './navTab.schema';

const router = Router();

// Public, role-aware: feeds the devotee nav bar + route guard for both
// anonymous guests and logged-in devotees.
router.get('/enabled', optionalAuthMiddleware, asyncHandler(navTabController.listEnabled));

router.use(authMiddleware);

router.get('/', permissionGuard('navTab', 'View'), asyncHandler(navTabController.listAll));
router.put(
  '/:key',
  permissionGuard('navTab', 'Update'),
  validate(setNavTabRolesSchema),
  asyncHandler(navTabController.setAllowedRoles)
);

export default router;
