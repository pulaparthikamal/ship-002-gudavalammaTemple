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
import { localeMiddleware } from './middlewares/locale.middleware';

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

// Locale extractor — negotiate among every currently-enabled language from
// Accept-Language, defaulting to English. See locale.middleware.ts.
app.use(localeMiddleware);

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


// API Routes
app.use(appConfig.apiPrefix, routes);

// 404 & Global Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
