import { Router } from 'express';
import { toneController } from './tone.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { validate } from '../../middlewares/validate.middleware';
import { createToneSchema } from './tone.schema';

const router = Router();

router.get('/', authMiddleware, asyncHandler(toneController.getTones));
router.post('/', authMiddleware, validate(createToneSchema), asyncHandler(toneController.createTone));
router.delete('/:id', authMiddleware, asyncHandler(toneController.deleteTone));

export default router;
