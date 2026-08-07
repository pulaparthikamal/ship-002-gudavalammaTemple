import { Router } from 'express';
import { remediationController } from '../controllers/remediation.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import {
  planRemediationSchema,
  executeRemediationSchema,
  listRemediationSchema,
  rollbackRemediationSchema,
} from '../server-management.schema';

const router = Router();

router.use(authMiddleware);

router.post('/plan', validate(planRemediationSchema), asyncHandler(remediationController.plan));
router.post('/:id/execute', validate(executeRemediationSchema), asyncHandler(remediationController.execute));
router.post('/:id/rollback', validate(rollbackRemediationSchema), asyncHandler(remediationController.rollback));
router.post('/:id/cancel', asyncHandler(remediationController.cancel));
router.get('/list', validate(listRemediationSchema), asyncHandler(remediationController.list));

export default router;
