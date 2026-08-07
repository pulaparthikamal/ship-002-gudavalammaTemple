import { connectDB } from '../config/db.config';
import { migrateSchemaV1 } from './migrations/update-schema-v1';
import { logger } from '../utils/logger.util';
import mongoose from 'mongoose';

const run = async () => {
  try {
    await connectDB();
    await migrateSchemaV1();
    logger.info('Migration run finished.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
};

run();
