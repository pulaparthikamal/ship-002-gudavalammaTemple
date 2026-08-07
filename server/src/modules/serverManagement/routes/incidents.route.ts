import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import {
  incidentAnalyzeSchema,
  incidentIdParamsSchema,
  incidentQuerySchema,
} from '../server-management.schema';
import { incidentController } from '../controllers/incident.controller';

const router = Router();

router.use(authMiddleware);
router.post('/analyze', validate(incidentAnalyzeSchema), asyncHandler(incidentController.analyze));
router.get('/', validate(incidentQuerySchema), asyncHandler(incidentController.list));
router.get('/:incidentId', validate(incidentIdParamsSchema), asyncHandler(incidentController.getById));
router.post('/:incidentId/acknowledge', validate(incidentIdParamsSchema), asyncHandler(incidentController.acknowledge));
router.post('/:incidentId/resolve', validate(incidentIdParamsSchema), asyncHandler(incidentController.resolve));

export default router;
