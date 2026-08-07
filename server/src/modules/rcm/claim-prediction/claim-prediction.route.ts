import { Router } from 'express';
import { claimPredictionController } from './claim-prediction.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';

const router = Router();

router.use(authMiddleware);

router.post('/', permissionGuard('claim-predictions', 'Add'), asyncHandler(claimPredictionController.predict));
router.post('/claim/:claimId', permissionGuard('claim-predictions', 'Add'), asyncHandler(claimPredictionController.predictByClaimId));
router.post('/charge/:chargeId', permissionGuard('claim-predictions', 'Add'), asyncHandler(claimPredictionController.predictByChargeId));
router.post('/encounter/:encounterId', permissionGuard('claim-predictions', 'Add'), asyncHandler(claimPredictionController.predictByEncounterId));
router.post('/appointment/:id/estimate', permissionGuard('claim-predictions', 'Add'), asyncHandler(claimPredictionController.estimateByAppointmentId));
router.get('/', permissionGuard('claim-predictions', 'View'), asyncHandler(claimPredictionController.list));

export default router;
