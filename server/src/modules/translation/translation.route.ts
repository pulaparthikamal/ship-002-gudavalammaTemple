import { Router } from 'express';
import { translationController } from './translation.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { translateEntriesSchema } from './translation.schema';

const router = Router();

// Public: any visitor (staff or devotee, logged in or not) may switch language.
router.post('/:locale', validate(translateEntriesSchema), asyncHandler(translationController.translateEntries));

export default router;
