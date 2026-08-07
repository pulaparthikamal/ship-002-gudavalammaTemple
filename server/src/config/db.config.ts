import mongoose from 'mongoose';
import { envConfig } from './env.config';
import { syncLoadedModelIndexes } from './db-index-sync.config';

const MAX_RETRIES = 5;
const RETRY_DELAY = 3000;

export const connectDB = async (retryCount = 0): Promise<void> => {
  try {
    await mongoose.connect(envConfig.mongoUri, {
      maxPoolSize: envConfig.mongoMaxPoolSize,
      serverSelectionTimeoutMS: 30000,  // wait up to 30s for a server (was 5s — too short for blips)
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,               // auto-retry write operations on transient failures
      retryReads: true,                // auto-retry read operations on transient failures
      connectTimeoutMS: 30000,
    });
    console.log('MongoDB connected successfully');
    // Await here so index sync completes before server.listen() opens the port.
    // All model.syncIndexes() calls run in parallel (see db-index-sync.config.ts),
    // so this is fast (~one round-trip latency) and keeps the connection pool
    // free for real requests immediately after the server starts.
    await syncLoadedModelIndexes();
  } catch (error) {
    console.error(`MongoDB connection failed (Attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
    if (retryCount < MAX_RETRIES - 1) {
      console.log(`Retrying connection in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      await connectDB(retryCount + 1);
      return;
    } else {
      console.error('Max connection retries reached. Exiting application...');
      process.exit(1);
    }
  }

  console.log(envConfig.mongoUri);
  mongoose.connection.on('disconnected', () => {
    console.error('MongoDB disconnected! Mongoose will attempt to reconnect automatically.');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected successfully.');
  });

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
  });
};
