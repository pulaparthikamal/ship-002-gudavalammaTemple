import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { diskCleanupController } from '../controllers/diskCleanup.controller';

const router = Router();

router.use(authMiddleware);
router.get('/policy/:serverId', asyncHandler(diskCleanupController.getPolicy));
router.post('/policy', asyncHandler(diskCleanupController.savePolicy));
router.post('/scan/:serverId', asyncHandler(diskCleanupController.scan));
router.post('/execute/:serverId', asyncHandler(diskCleanupController.execute));
router.get('/history/:serverId', asyncHandler(diskCleanupController.history));
router.get('/jobs/:serverId', asyncHandler(diskCleanupController.jobs));
router.get('/latest-summary/:serverId', asyncHandler(diskCleanupController.latestSummary));

export default router;
