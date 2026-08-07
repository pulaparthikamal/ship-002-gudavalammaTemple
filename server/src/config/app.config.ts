import { envConfig } from './env.config';

export const appConfig = {
  name: envConfig.appName,
  port: envConfig.port,
  apiPrefix: envConfig.apiPrefix,
  env: envConfig.nodeEnv,
  isDevelopment: envConfig.nodeEnv === 'development',
  isProduction: envConfig.nodeEnv === 'production',
};
