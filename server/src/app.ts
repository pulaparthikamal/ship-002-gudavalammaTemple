import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import xss from 'xss-clean';
import swaggerUi from 'swagger-ui-express';

import { appConfig } from './config/app.config';
import { corsConfig } from './config/cors.config';
import { swaggerSpec } from './config/swagger.config';
import { envConfig } from './config/env.config';

import { morganMiddleware, requestIdMiddleware } from './middlewares/requestLogger.middleware';
import { apiRateLimiter } from './middlewares/rateLimiter.middleware';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';

import routes from './routes';
import facebookRoutes from './modules/facebook/facebook.route';
import instagramRoutes from './modules/instagram/instagram.route';
import linkedInRoutes from './modules/linkedin/linkedin.route';
import platformConfigRoutes from './modules/platform/platformConfig.route';
import youtubeRoutes from './modules/youtube/youtube.route';

const app: Express = express();

// Security Middlewares
// app.use(helmet());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(corsConfig));
app.use(xss());
app.use(hpp());
app.use(apiRateLimiter);

// Parse JSON and url-encoded body. Preserve raw JSON bytes for signed healthcare webhooks.
app.use(express.json({
  limit: envConfig.nodeEnv === 'production' ? '10mb' : '50mb',
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: true, limit: envConfig.nodeEnv === 'production' ? '10mb' : '50mb' }));

// Logging & Tracking
app.use(requestIdMiddleware);
app.use(morganMiddleware);

// Locale extractor
app.use((req: Request, res: Response, next: NextFunction) => {
  const lang = req.acceptsLanguages()[0] || 'en';
  req.locale = lang.startsWith('en') ? 'en' : 'en'; // Currently supporting only EN
  next();
});

// Swagger Docs
app.use(`${appConfig.apiPrefix}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Static file uploads
app.use(
  `${appConfig.apiPrefix}/uploads`,
  (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.resolve(process.cwd(), envConfig.uploadRootDir))
);


// Serve AgenticServer generated media
app.use(
  `/social_media_posts`,
  express.static(path.resolve(process.cwd(), '../AgenticServer/media/social_media_posts'))
);

// Facebook Auth (outside API prefix as requested)
app.use('/auth/facebook', facebookRoutes);
app.use('/auth/instagram', instagramRoutes);

// LinkedIn Auth (outside API prefix, same pattern as Facebook)
app.use('/auth/linkedin', linkedInRoutes);

// YouTube Auth
app.use('/auth/youtube', youtubeRoutes);

// Platform Configs
app.use(`${appConfig.apiPrefix}/platform-configs`, platformConfigRoutes);

// API Routes
app.use(appConfig.apiPrefix, routes);

// 404 & Global Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
