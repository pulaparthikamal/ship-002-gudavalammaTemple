import { envConfig } from './env.config';

const config: any = {
  appName: envConfig.appName || 'Enterprise API',
  port: envConfig.port || 3000,
  env: envConfig.nodeEnv || 'development',
  apiPrefix: envConfig.apiPrefix || '/api/v1',
  db: {
    uri: envConfig.mongoUri || 'mongodb://localhost:27017/enterprise-node-backend-template',
  },
  jwt: {
    secret: envConfig.jwtAccessSecret || 'secret',
    accessExpirationMinutes: 30, // Defaulting as not in envConfig
    refreshExpirationDays: 30, // Defaulting as not in envConfig
  },
  email: {
    smtp: {
      host: envConfig.mailHost || 'smtp.example.com',
      port: envConfig.mailPort || 587,
      auth: {
        user: envConfig.mailUser || 'user',
        pass: envConfig.mailPass || 'pass',
      },
    },
    from: envConfig.mailFrom || 'noreply@example.com',
  },
  // Pagination Defaults
  limit: 10,
  page: 1,
  sortfield: 'created',
  direction: 'desc',
};

export default config;
