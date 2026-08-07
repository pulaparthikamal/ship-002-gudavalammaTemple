import mongoose, { Model } from 'mongoose';
import { logger } from '../utils/logger.util';

function isIgnorableIndexSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('ns not found')
    || message.includes('NamespaceNotFound')
    || message.includes('index not found')
    || message.includes('IndexNotFound')
  );
}

function getLoadedModels(): Array<Model<any>> {
  return Object.values(mongoose.models);
}

export async function syncLoadedModelIndexes(): Promise<void> {
  const models = getLoadedModels();

  if (!models.length) {
    logger.warn('Skipping index synchronization because no Mongoose models are loaded.');
    return;
  }

  const droppedPerModel = await Promise.all(
    models.map(async (model) => {
      try {
        const syncResult = await model.syncIndexes();
        return Array.isArray(syncResult)
          ? syncResult.filter((indexName): indexName is string => typeof indexName === 'string')
          : [];
      } catch (error) {
        if (isIgnorableIndexSyncError(error)) {
          return [];
        }
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Unable to synchronize indexes for ${model.modelName}: ${message}`);
        return [];
      }
    })
  );

  models.forEach((model, i) => {
    const dropped = droppedPerModel[i];
    if (dropped.length) {
      logger.warn(
        `Removed stale indexes for ${model.modelName} (${model.collection.name}): ${dropped.join(', ')}`
      );
    }
  });

  const removedIndexCount = droppedPerModel.reduce((sum, arr) => sum + arr.length, 0);

  logger.info(
    removedIndexCount > 0
      ? `Mongoose index synchronization completed. Removed ${removedIndexCount} stale indexes.`
      : 'Mongoose index synchronization completed. No stale indexes were found.'
  );
}
