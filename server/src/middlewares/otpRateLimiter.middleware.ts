import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';
import { envConfig } from '../config/env.config';
import { HTTP_STATUS } from '../constants/httpStatus.constants';

const bypassRateLimiter: RequestHandler = (_req, _res, next) => next();

/**
 * Tighter, dedicated limiter for OTP requests — keyed by phone number (not
 * just IP), so one IP can't be used to lock out many phone numbers, and one
 * phone number can't be spammed from rotating IPs. The global apiRateLimiter
 * is IP-only and far too loose for an abuse-prone, cost-bearing endpoint like
 * this (every request can trigger a WhatsApp/email send).
 */
export const otpRequestRateLimiter: RequestHandler = envConfig.rateLimitEnabled
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => envConfig.nodeEnv === 'development',
      keyGenerator: (req) => String(req.body?.phone || req.ip),
      message: {
        success: false,
        statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
        respMessage: 'Too many OTP requests. Please try again later.',
      },
    })
  : bypassRateLimiter;
