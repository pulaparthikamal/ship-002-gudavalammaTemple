import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';
import { envConfig } from '../config/env.config';
import { HTTP_STATUS } from '../constants/httpStatus.constants';

const bypassRateLimiter: RequestHandler = (_req, _res, next) => next();

export const apiRateLimiter: RequestHandler = envConfig.rateLimitEnabled ? rateLimit({
  windowMs: envConfig.rateLimitWindowMs,
  max: envConfig.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => envConfig.nodeEnv === 'development',
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    respMessage: 'Too many requests from this IP, please try again later.',
  },
}) : bypassRateLimiter;
