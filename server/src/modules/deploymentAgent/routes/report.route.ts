import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import {
  getReportQuerySchema,
  getPm2QuerySchema,
  exportReportSchema,
} from '../deployment-agent.schema';
import { reportController } from '../controllers/report.controller';

const router = Router();

router.use(authMiddleware);

router.get('/dashboard', asyncHandler(reportController.getDashboardStats));
router.get('/deployments', validate(getReportQuerySchema), asyncHandler(reportController.getDeploymentsReport));
router.get('/versions', validate(getReportQuerySchema), asyncHandler(reportController.getVersionsReport));
router.get('/servers', asyncHandler(reportController.getServersReport));
router.get('/health-checks', validate(getReportQuerySchema), asyncHandler(reportController.getHealthChecksReport));
router.get('/pm2', validate(getPm2QuerySchema), asyncHandler(reportController.getPm2Report));
router.get('/failures', validate(getReportQuerySchema), asyncHandler(reportController.getFailuresReport));
router.get('/users', asyncHandler(reportController.getUserActivityReport));
router.get('/audit-trail', validate(getReportQuerySchema), asyncHandler(reportController.getAuditTrailReport));
router.get('/export', validate(exportReportSchema), asyncHandler(reportController.exportReport));

export default router;
