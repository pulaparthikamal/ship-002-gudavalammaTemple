import { Router } from 'express';
import { expenseEntryController } from './expenseEntry.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createExpenseEntrySchema, updateExpenseEntrySchema, bulkCreateExpenseEntrySchema } from './expenseEntry.schema';

const router = Router();

router.use(authMiddleware);

// Fixed sub-paths must be registered before the '/:id' param route.
router.get('/summary', permissionGuard('expenseEntry', 'View'), asyncHandler(expenseEntryController.summary));
router.post('/bulk', permissionGuard('expenseEntry', 'Add'), validate(bulkCreateExpenseEntrySchema), asyncHandler(expenseEntryController.bulkCreate));

router.get('/', permissionGuard('expenseEntry', 'View'), asyncHandler(expenseEntryController.list));
router.get('/:id', permissionGuard('expenseEntry', 'View'), asyncHandler(expenseEntryController.getById));

router.post('/', permissionGuard('expenseEntry', 'Add'), validate(createExpenseEntrySchema), asyncHandler(expenseEntryController.create));
router.put('/:id', permissionGuard('expenseEntry', 'Update'), validate(updateExpenseEntrySchema), asyncHandler(expenseEntryController.update));
router.delete('/:id', permissionGuard('expenseEntry', 'Delete'), asyncHandler(expenseEntryController.delete));

export default router;
