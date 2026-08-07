import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { eraExceptionController } from './era-exception.controller';
import { createEraExceptionSchema, eraExceptionActionSchema, updateEraExceptionSchema } from './era-exception.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('era-exceptions', 'View'), asyncHandler(eraExceptionController.list));
router.get('/:id', permissionGuard('era-exceptions', 'View'), asyncHandler(eraExceptionController.getById));
router.post('/', permissionGuard('era-exceptions', 'Add'), validate(createEraExceptionSchema), asyncHandler(eraExceptionController.create));
router.put('/:id', permissionGuard('era-exceptions', 'Update'), validate(updateEraExceptionSchema), asyncHandler(eraExceptionController.update));
router.post('/:id/ai-explain', permissionGuard('era-exceptions', 'Update'), asyncHandler(eraExceptionController.aiExplain));
router.post('/:id/actions/:action', permissionGuard('era-exceptions', 'Update'), validate(eraExceptionActionSchema), asyncHandler(eraExceptionController.action));
router.delete('/:id', permissionGuard('era-exceptions', 'Delete'), asyncHandler(eraExceptionController.delete));

export default router;
