import { Router } from 'express';
import { expenseEventController } from './expenseEvent.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createExpenseEventSchema, updateExpenseEventSchema } from './expenseEvent.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('expenseEvent', 'View'), asyncHandler(expenseEventController.list));
router.get('/:id', permissionGuard('expenseEvent', 'View'), asyncHandler(expenseEventController.getById));

router.post('/', permissionGuard('expenseEvent', 'Add'), validate(createExpenseEventSchema), asyncHandler(expenseEventController.create));
router.put('/:id', permissionGuard('expenseEvent', 'Update'), validate(updateExpenseEventSchema), asyncHandler(expenseEventController.update));
router.delete('/:id', permissionGuard('expenseEvent', 'Delete'), asyncHandler(expenseEventController.delete));

export default router;
