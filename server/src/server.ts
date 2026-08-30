import app from './app';
import http from 'http';
import { appConfig } from './config/app.config';
import { connectDB } from './config/db.config';
import { logger } from './utils/logger.util';
import { startAnalyticsRollupCron } from './jobs/analyticsRollup.job';

const startServer = async () => {
  try {
    // The only genuine prerequisite for serving requests.
    await connectDB();
    startAnalyticsRollupCron();

    const server = http.createServer(app);

    server.listen(appConfig.port, () => {
      logger.info(
        `${appConfig.name} is running in ${appConfig.env} mode on port ${appConfig.port}`
      );
      logger.info(
        `API Documentation available at http://localhost:${appConfig.port}${appConfig.apiPrefix}/docs`
      );

      console.log('\n===================================================');
      console.log(`🚀 Server running on port: \x1b[32m${appConfig.port}\x1b[0m`);
      console.log(`🌐 Base URL: \x1b[36mhttp://localhost:${appConfig.port}\x1b[0m`);
      console.log(`📚 API Docs: \x1b[36mhttp://localhost:${appConfig.port}${appConfig.apiPrefix}/docs\x1b[0m`);
      console.log('===================================================\n');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err: Error) => {
      const msg = err?.message || String(err);
      const name = (err as any)?.name || '';

      // Ignore transient MongoDB errors — Mongoose reconnects automatically, no need to crash
      const isTransientMongoError = /MongoPoolClearedError|MongoNetworkError|MongoServerSelectionError|PoolClearedOnNetworkError/i.test(name)
        || /connection.*timed out|ENETUNREACH|ECONNREFUSED|server selection timed out/i.test(msg);

      if (isTransientMongoError) return;

      logger.error('UNHANDLED REJECTION! Shutting down...', err);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err: Error) => {
      const msg = err?.message || String(err);
      const name = (err as any)?.name || '';

      // Ignore transient MongoDB errors — Mongoose reconnects automatically
      const isTransientMongoError = /MongoPoolClearedError|MongoNetworkError|MongoServerSelectionError|PoolClearedOnNetworkError/i.test(name)
        || /connection.*timed out|ENETUNREACH|ECONNREFUSED|server selection timed out/i.test(msg);

      if (isTransientMongoError) return;

      logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
      process.exit(1);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Closing server...');
      server.close(() => process.exit(0));
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
