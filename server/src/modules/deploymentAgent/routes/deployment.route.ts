import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import reportRoutes from './report.route';
import {
  triggerDeploymentSchema,
  deploymentIdParamsSchema,
  listDeploymentsQuerySchema,
  rollbackDeploymentSchema,
  cancelDeploymentSchema,
  deploymentLogsQuerySchema,
  analyzeRollbackSchema,
  predictDeploymentSchema,
  listPredictionsQuerySchema,
  predictionIdParamsSchema,
  appVersionsQuerySchema,
  rollbackToVersionSchema,
  getReportQuerySchema,
} from '../deployment-agent.schema';
import { deploymentController } from '../controllers/deployment.controller';
import { reportController } from '../controllers/report.controller';

const router = Router();

router.use(authMiddleware);

router.get('/dashboard/rollback-stats', asyncHandler(deploymentController.getRollbackStats));

// Predictive intelligence (literal paths declared before /:id param routes)
router.post('/predict', validate(predictDeploymentSchema), asyncHandler(deploymentController.predict));
router.get('/predictions', validate(listPredictionsQuerySchema), asyncHandler(deploymentController.listPredictions));
router.get('/predictions/:id', validate(predictionIdParamsSchema), asyncHandler(deploymentController.getPredictionById));

// Static-prefix routes must come before /:id to avoid being swallowed by the dynamic segment
router.get('/application-versions', validate(appVersionsQuerySchema), asyncHandler(deploymentController.getApplicationVersionHistory));
router.post('/application-versions/:targetDeploymentId/rollback', validate(rollbackToVersionSchema), asyncHandler(deploymentController.rollbackToVersion));

router.post('/trigger', validate(triggerDeploymentSchema), asyncHandler(deploymentController.trigger));
router.get('/', validate(listDeploymentsQuerySchema), asyncHandler(deploymentController.list));
router.get('/notifications', validate(getReportQuerySchema), asyncHandler(reportController.getNotificationsReport));
router.get('/:id', validate(deploymentIdParamsSchema), asyncHandler(deploymentController.getById));
router.post('/:id/cancel', validate(cancelDeploymentSchema), asyncHandler(deploymentController.cancel));
router.post('/:id/rollback', validate(rollbackDeploymentSchema), asyncHandler(deploymentController.rollback));
router.get('/:id/logs', validate(deploymentLogsQuerySchema), asyncHandler(deploymentController.getLogs));
router.get('/:id/versions', validate(deploymentIdParamsSchema), asyncHandler(deploymentController.getVersionHistory));
router.post('/:id/analyze-rollback', validate(analyzeRollbackSchema), asyncHandler(deploymentController.analyzeRollback));
router.get('/:id/rollback-history', validate(deploymentIdParamsSchema), asyncHandler(deploymentController.getRollbackHistory));
router.get('/:id/prediction', validate(deploymentIdParamsSchema), asyncHandler(deploymentController.getDeploymentPrediction));

router.use('/reports', reportRoutes);

export default router;
