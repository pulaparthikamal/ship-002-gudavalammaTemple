import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { connectServerSchema } from '../server-management.schema';
import { serverManagementController } from '../controllers/server.controller';
import { projectController } from '../controllers/project.controller';

const router = Router();
const pemUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024, files: 1 },
});

router.use(authMiddleware);
router.post('/connect', validate(connectServerSchema), asyncHandler(serverManagementController.connect));
router.post('/connect/upload', pemUpload.single('pemFile'), asyncHandler(serverManagementController.connectWithPem));
router.get('/list', asyncHandler(serverManagementController.list));
router.get('/:serverId/projects', asyncHandler(projectController.list));
router.post('/:serverId/projects/sync', asyncHandler(projectController.sync));
router.put('/:id', asyncHandler(serverManagementController.update));
router.patch('/:id', asyncHandler(serverManagementController.update));
router.put('/:id/upload', pemUpload.single('pemFile'), asyncHandler(serverManagementController.updateWithPem));
router.patch('/:id/upload', pemUpload.single('pemFile'), asyncHandler(serverManagementController.updateWithPem));
router.delete('/:id', asyncHandler(serverManagementController.remove));
router.post('/multiDelete', asyncHandler(serverManagementController.bulkRemove));

export default router;
