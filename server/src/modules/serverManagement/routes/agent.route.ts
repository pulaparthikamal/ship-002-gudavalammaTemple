import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import {
  latestPredictionQuerySchema,
  predictMaintenanceSchema,
  predictionHistoryQuerySchema,
  runAgentSchema,
} from '../server-management.schema';
import { agentController } from '../controllers/agent.controller';

const router = Router();

router.use(authMiddleware);
router.post('/run', validate(runAgentSchema), asyncHandler(agentController.run));
router.post('/predict', validate(predictMaintenanceSchema), asyncHandler(agentController.predictMaintenance));
router.get('/predictions/latest', validate(latestPredictionQuerySchema), asyncHandler(agentController.getLatestPrediction));
router.get('/predictions', validate(predictionHistoryQuerySchema), asyncHandler(agentController.listPredictions));
router.post('/predictions/:id/feedback', asyncHandler(agentController.addFeedback));

export default router;
