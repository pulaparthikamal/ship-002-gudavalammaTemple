import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { tableViewController } from './tableView.controller';
import {
  tableViewPreferenceParamsSchema,
  updateTableViewPreferenceSchema,
} from './tableView.schema';

const router = Router();

router.use(authMiddleware);

router.get(
  '/:tableId',
  validate(tableViewPreferenceParamsSchema),
  asyncHandler(tableViewController.getPreference),
);
router.put(
  '/:tableId',
  validate(updateTableViewPreferenceSchema),
  asyncHandler(tableViewController.updatePreference),
);

export default router;
