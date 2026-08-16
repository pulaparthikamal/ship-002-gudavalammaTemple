import { Router } from 'express';
import { prasadamController } from './prasadam.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../../middlewares/optionalAuth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { createPrasadamItemSchema, updatePrasadamItemSchema, createPrasadamOrderSchema } from './prasadam.schema';

const itemRouter = Router();

// Public: catalog browse — guests can see prasadam items without logging in.
itemRouter.get('/', asyncHandler(prasadamController.listItems));

// Staff-only catalog management.
itemRouter.post(
  '/',
  authMiddleware,
  permissionGuard('prasadamItem', 'Add'),
  validate(createPrasadamItemSchema),
  asyncHandler(prasadamController.createItem)
);
itemRouter.put(
  '/:id',
  authMiddleware,
  permissionGuard('prasadamItem', 'Update'),
  validate(updatePrasadamItemSchema),
  asyncHandler(prasadamController.updateItem)
);
itemRouter.delete('/:id', authMiddleware, permissionGuard('prasadamItem', 'Delete'), asyncHandler(prasadamController.deleteItem));

const orderRouter = Router();

orderRouter.use(optionalAuthMiddleware);

orderRouter.post('/', validate(createPrasadamOrderSchema), asyncHandler(prasadamController.createOrder));

export const prasadamItemRoutes = itemRouter;
export const prasadamOrderRoutes = orderRouter;
