import { Router } from 'express';
import { PlatformConfigController } from './platformConfig.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleGuard } from '../../middlewares/role.middleware';
import { RoleEnum } from '../../constants/roles.constants';

const router = Router();

// Protect all routes with auth and role guards
router.use(authMiddleware);
router.use(roleGuard(RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN));

router.get('/', PlatformConfigController.getConfigs);
router.post('/', PlatformConfigController.updateConfig);
router.delete('/:platform', PlatformConfigController.deleteConfig);

export default router;
