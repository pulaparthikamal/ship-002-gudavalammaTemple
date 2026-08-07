import { envConfig } from './env.config';

export const corsConfig = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (envConfig.nodeEnv === 'development' || !origin || envConfig.allowedOrigins.indexOf(origin) !== -1 || envConfig.allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['X-Total-Count', 'X-Request-Id'],
};
