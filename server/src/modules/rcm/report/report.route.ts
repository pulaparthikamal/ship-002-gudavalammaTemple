import { Router } from 'express';
import { reportController } from './report.controller';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/dashboard', permissionGuard('reports', 'View'), asyncHandler(reportController.dashboard));
router.get('/claims', permissionGuard('reports', 'View'), asyncHandler(reportController.claims));
router.get('/financial', permissionGuard('reports', 'View'), asyncHandler(reportController.financial));
router.get('/denials', permissionGuard('reports', 'View'), asyncHandler(reportController.denials));
router.get('/appeals', permissionGuard('reports', 'View'), asyncHandler(reportController.appeals));
router.get('/ar', permissionGuard('reports', 'View'), asyncHandler(reportController.ar));
router.get('/patient-billing', permissionGuard('reports', 'View'), asyncHandler(reportController.patientBilling));
router.get('/productivity', permissionGuard('reports', 'View'), asyncHandler(reportController.productivity));
router.get('/realtime', permissionGuard('reports', 'View'), asyncHandler(reportController.realtime));
router.get('/claim-closure', permissionGuard('reports', 'View'), asyncHandler(reportController.claimClosure));
router.get('/financial-risk', permissionGuard('reports', 'View'), asyncHandler(reportController.financialRisk));
router.get('/timely-filing', permissionGuard('reports', 'View'), asyncHandler(reportController.timelyFiling));
router.get('/ai-operations', permissionGuard('reports', 'View'), asyncHandler(reportController.aiOperations));
router.get('/export', permissionGuard('reports', 'View'), asyncHandler(reportController.export));
router.get('/rcm-operations', permissionGuard('reports', 'View'), asyncHandler(reportController.rcmOperations));
router.get('/', permissionGuard('reports', 'View'), asyncHandler(reportController.dashboard));

export default router;
