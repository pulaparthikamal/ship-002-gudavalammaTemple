import { Router } from 'express';
import { languageController } from './language.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { setLanguageEnabledSchema } from './language.schema';

const router = Router();

// Public: feeds the language switcher for anyone (staff or devotee, logged in or not).
router.get('/enabled', asyncHandler(languageController.listEnabled));

router.use(authMiddleware);

router.get('/', permissionGuard('language', 'View'), asyncHandler(languageController.listAll));
router.put(
  '/:code',
  permissionGuard('language', 'Update'),
  validate(setLanguageEnabledSchema),
  asyncHandler(languageController.setEnabled)
);

export default router;
