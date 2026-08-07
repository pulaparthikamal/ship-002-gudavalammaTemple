import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { getConfigSchema, saveConfigSchema } from '../server-management.schema';
import { serverConfigController } from '../controllers/config.controller';

const router = Router();

router.use(authMiddleware);
router.post('/save', validate(saveConfigSchema), asyncHandler(serverConfigController.save));
router.get('/', validate(getConfigSchema), asyncHandler(serverConfigController.get));

export default router;
