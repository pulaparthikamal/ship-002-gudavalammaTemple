import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { otpRequestRateLimiter } from '../../middlewares/otpRateLimiter.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from './auth.schema';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(authController.register));
router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.post(
  '/otp/request',
  otpRequestRateLimiter,
  validate(requestOtpSchema),
  asyncHandler(authController.requestOtp)
);
router.post('/otp/verify', validate(verifyOtpSchema), asyncHandler(authController.verifyOtp));
router.post('/refresh-token', validate(refreshTokenSchema), asyncHandler(authController.refreshToken));

// Protected routes
router.use(authMiddleware);
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', asyncHandler(authController.getMe));
router.post('/change-password', validate(changePasswordSchema), asyncHandler(authController.changePassword));

export default router;
