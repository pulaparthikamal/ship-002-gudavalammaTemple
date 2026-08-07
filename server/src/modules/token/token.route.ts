import { Router } from 'express';
import { tokenController } from './token.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleGuard, permissionGuard } from '../../middlewares/role.middleware';
import { RoleEnum } from '../../constants/roles.constants';
import { updateTokenStatusSchema } from './token.schema';

const router = Router();

router.use(authMiddleware);
router.get('/', permissionGuard('tokens', 'View'), asyncHandler(tokenController.list));
router.patch('/:id/status', permissionGuard('tokens', 'Update'), validate(updateTokenStatusSchema), asyncHandler(tokenController.toggleStatus));
router.delete('/:id', permissionGuard('tokens', 'Delete'), asyncHandler(tokenController.delete));

export default router;
