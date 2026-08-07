import { Router } from 'express';
import { ruleController } from './rule.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';

const router = Router();

router.use(authMiddleware);

router.post('/', permissionGuard('rules', 'Add'), asyncHandler(ruleController.create));
router.get('/', permissionGuard('rules', 'View'), asyncHandler(ruleController.list));
router.get('/:id', permissionGuard('rules', 'View'), asyncHandler(ruleController.getById));
router.patch('/:id', permissionGuard('rules', 'Update'), asyncHandler(ruleController.update));
router.delete('/:id', permissionGuard('rules', 'Delete'), asyncHandler(ruleController.delete));

export default router;
