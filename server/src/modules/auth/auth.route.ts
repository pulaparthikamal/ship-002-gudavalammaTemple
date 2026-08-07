import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from './auth.schema';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(authController.register));
router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.post('/refresh-token', validate(refreshTokenSchema), asyncHandler(authController.refreshToken));

// Protected routes
router.use(authMiddleware);
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', asyncHandler(authController.getMe));
router.post('/change-password', validate(changePasswordSchema), asyncHandler(authController.changePassword));

export default router;
