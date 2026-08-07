import { Router } from 'express';
import { platformController } from './platform.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';

const router = Router();

router.get('/', authMiddleware, asyncHandler(platformController.getPlatforms));
router.post('/', authMiddleware, asyncHandler(platformController.createPlatform));
router.delete('/:id', authMiddleware, asyncHandler(platformController.deletePlatform));

export default router;
