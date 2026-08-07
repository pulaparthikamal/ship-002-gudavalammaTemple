import { Router } from 'express';
import { coverageRuleController } from './coverage-rule.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';

const router = Router();

router.use(authMiddleware);

router.post('/evaluate', permissionGuard('coverage-rules', 'View'), asyncHandler(coverageRuleController.evaluate));
router.get('/', permissionGuard('coverage-rules', 'View'), asyncHandler(coverageRuleController.list));
router.get('/:id', permissionGuard('coverage-rules', 'View'), asyncHandler(coverageRuleController.getById));
router.post('/', permissionGuard('coverage-rules', 'Add'), asyncHandler(coverageRuleController.create));
router.put('/:id', permissionGuard('coverage-rules', 'Update'), asyncHandler(coverageRuleController.update));
router.delete('/:id', permissionGuard('coverage-rules', 'Delete'), asyncHandler(coverageRuleController.delete));

export default router;
