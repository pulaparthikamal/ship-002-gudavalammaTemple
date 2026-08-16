import env from 'env-var';
import { config } from 'dotenv';

config();

export const envConfig = {
  nodeEnv: env.get('NODE_ENV').default('development').asString(),
  port: env.get('PORT').default(5003).asPortNumber(),
  apiPrefix: env.get('API_PREFIX').default('/api/v1').asString(),
  appName: env.get('APP_NAME').default('MyApp').asString(),
  allowedOrigins: env.get('ALLOWED_ORIGINS').default('http://localhost:3000,http://localhost:5173,http://192.168.1.13:5173').asArray(','),

  mongoUri: env.get('MONGO_URI').required().asString(),
  mongoMaxPoolSize: env.get('MONGO_MAX_POOL_SIZE').default(10).asIntPositive(),

  jwtAccessSecret: env.get('JWT_ACCESS_SECRET').required().asString(),
  jwtRefreshSecret: env.get('JWT_REFRESH_SECRET').required().asString(),
  jwtAccessExpiresIn: env.get('JWT_ACCESS_EXPIRES_IN').default('15m').asString(),
  jwtRefreshExpiresIn: env.get('JWT_REFRESH_EXPIRES_IN').default('7d').asString(),

  mailHost: env.get('MAIL_HOST').required().asString(),
  mailPort: env.get('MAIL_PORT').default(587).asPortNumber(),
  mailUser: env.get('MAIL_USER').required().asString(),
  mailPass: env.get('MAIL_PASS').required().asString(),
  mailFrom: env.get('MAIL_FROM').required().asString(),

  defaultPage: env.get('DEFAULT_PAGE').default(1).asIntPositive(),
  defaultLimit: env.get('DEFAULT_LIMIT').default(10).asIntPositive(),

  rateLimitEnabled: env.get('RATE_LIMIT_ENABLED').default('true').asBoolStrict(),
  rateLimitWindowMs: env.get('RATE_LIMIT_WINDOW_MS').default(900000000).asIntPositive(),
  rateLimitMax: env.get('RATE_LIMIT_MAX').default(100000000).asIntPositive(),

  uploadRootDir: env.get('UPLOAD_ROOT_DIR').default('uploads').asString(),
  uploadMaxFileSizeMb: env.get('UPLOAD_MAX_FILE_SIZE_MB').default(50).asIntPositive(),

  frontendUrl: env.get('FRONTEND_URL').default('http://localhost:5173').asString(),

  // WhatsApp booking/donation confirmations via Meta's WhatsApp Cloud API
  // directly (no Twilio markup) — see services/notification/whatsapp.service.ts.
  // Optional: left blank, the service just logs and skips sending, the same
  // "never fail the booking" fire-and-forget behavior as the email path.
  whatsappPhoneNumberId: env.get('WHATSAPP_PHONE_NUMBER_ID').default('').asString(),
  whatsappAccessToken: env.get('WHATSAPP_ACCESS_TOKEN').default('').asString(),
  whatsappApiVersion: env.get('WHATSAPP_API_VERSION').default('v21.0').asString(),
  // Meta requires an approved message template for business-initiated
  // messages (a booking confirmation isn't a reply within a customer-service
  // window). Defaults to Meta's own zero-parameter quickstart demo template,
  // "hello_world" — real booking details only reach the devotee once a real
  // template (with body placeholders) is created and approved in the Meta
  // Business account and configured here.
  whatsappTemplateName: env.get('WHATSAPP_TEMPLATE_NAME').default('hello_world').asString(),
  whatsappTemplateLanguage: env.get('WHATSAPP_TEMPLATE_LANGUAGE').default('en_US').asString(),
  // Separate template for OTP login codes — Meta requires OTPs to use its
  // dedicated "Authentication" template category, a different approval track
  // from a general confirmation template. Same hello_world fallback/caveat.
  whatsappOtpTemplateName: env.get('WHATSAPP_OTP_TEMPLATE_NAME').default('hello_world').asString(),
  whatsappOtpTemplateLanguage: env.get('WHATSAPP_OTP_TEMPLATE_LANGUAGE').default('en_US').asString(),
};
