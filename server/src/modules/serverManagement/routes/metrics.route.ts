import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { cpuMetricsQuerySchema, metricSeriesQuerySchema, metricsQuerySchema, startScanSchema } from '../server-management.schema';
import { metricsController } from '../controllers/metrics.controller';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.get('/definitions', asyncHandler(metricsController.metricDefinitions));
router.get('/query', validate(metricSeriesQuerySchema), asyncHandler(metricsController.querySeries));
router.get('/cpu', validate(cpuMetricsQuerySchema), asyncHandler(metricsController.cpuMetrics));
router.get('/', validate(metricsQuerySchema), asyncHandler(metricsController.list));
router.post('/sync', validate(startScanSchema), asyncHandler(metricsController.collect));
router.get('/monitoring/status', validate(metricsQuerySchema), asyncHandler(metricsController.monitoringStatus));
router.get('/monitoring/history', validate(metricsQuerySchema), asyncHandler(metricsController.monitoringHistory));
router.get('/monitoring/cpu-trend', validate(metricsQuerySchema), asyncHandler(metricsController.cpuTrend));
router.get('/monitoring/health/latest', validate(metricsQuerySchema), asyncHandler(metricsController.latestHealthScore));
router.get('/monitoring/health', validate(metricsQuerySchema), asyncHandler(metricsController.healthScores));
router.get('/monitoring/spikes', validate(metricsQuerySchema), asyncHandler(metricsController.resourceSpikes));
router.post('/monitoring/collect', validate(startScanSchema), asyncHandler(metricsController.collectLightweight));

export default router;
