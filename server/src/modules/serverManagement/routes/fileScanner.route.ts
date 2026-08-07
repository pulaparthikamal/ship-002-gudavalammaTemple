import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { fileScannerController } from '../controllers/fileScanner.controller';
import { fileScannerIdSchema, fileScannerQuerySchema } from '../server-management.schema';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.get('/status', asyncHandler(fileScannerController.status));
router.get('/scan-now', asyncHandler(fileScannerController.scanNow));
router.post('/scan-now', asyncHandler(fileScannerController.scanNow));
router.get('/events', validate(fileScannerQuerySchema), asyncHandler(fileScannerController.events));
router.get('/results', validate(fileScannerQuerySchema), asyncHandler(fileScannerController.results));
router.get('/results/:id', validate(fileScannerIdSchema), asyncHandler(fileScannerController.result));
router.get('/alerts', validate(fileScannerQuerySchema), asyncHandler(fileScannerController.alerts));
router.get('/quarantine', validate(fileScannerQuerySchema), asyncHandler(fileScannerController.quarantine));
router.post('/results/:id/restore', validate(fileScannerIdSchema), asyncHandler(fileScannerController.restore));
router.post('/results/:id/mark-safe', validate(fileScannerIdSchema), asyncHandler(fileScannerController.markSafe));
router.delete('/results/:id/permanent-delete', validate(fileScannerIdSchema), asyncHandler(fileScannerController.permanentDelete));
router.post('/:id/restore', validate(fileScannerIdSchema), asyncHandler(fileScannerController.restore));
router.post('/:id/mark-safe', validate(fileScannerIdSchema), asyncHandler(fileScannerController.markSafe));
router.delete('/:id/permanent-delete', validate(fileScannerIdSchema), asyncHandler(fileScannerController.permanentDelete));

export default router;
