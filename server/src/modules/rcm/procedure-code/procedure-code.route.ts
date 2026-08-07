import { Router } from 'express';
import { procedureCodeController } from './procedure-code.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';

const router = Router();

router.use(authMiddleware);

router.post('/', permissionGuard('procedure-codes', 'Add'), asyncHandler(procedureCodeController.create));
router.get('/', permissionGuard('procedure-codes', 'View'), asyncHandler(procedureCodeController.list));
router.get('/:id', permissionGuard('procedure-codes', 'View'), asyncHandler(procedureCodeController.getById));
router.patch('/:id', permissionGuard('procedure-codes', 'Update'), asyncHandler(procedureCodeController.update));
router.delete('/:id', permissionGuard('procedure-codes', 'Delete'), asyncHandler(procedureCodeController.delete));

export default router;
