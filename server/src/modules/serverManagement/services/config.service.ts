import { Types } from 'mongoose';
import {
  IServerMaintenanceConfig,
  ServerMaintenanceConfig,
  defaultMaintenanceConfig,
} from '../models/config.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

const mutableConfigFields = [
  'diskThresholdPercent',
  'cpuThresholdPercent',
  'memoryThresholdPercent',
  'scanFrequencyMinutes',
  'predictionIntervalMinutes',
  'unusedFileDays',
  'largeFileMb',
  'archiveOlderThanDays',
  'deleteOlderThanDays',
  'cleanupAutomationEnabled',
  'cleanupFrequencyMinutes',
  'archiveLargeFileMb',
  'archiveDirectory',
  'scanDirectories',
  'ignoreFolders',
  'tempPatterns',
  'logPatterns',
  'automationEnabled',
  'maxRestartAttempts',
  'restartCooldownMinutes',
  'rules',
] as const;

type MutableConfigField = (typeof mutableConfigFields)[number];

const pickConfigPayload = (payload: Partial<IServerMaintenanceConfig>) =>
  mutableConfigFields.reduce<Partial<IServerMaintenanceConfig>>((acc, field) => {
    if (payload[field as MutableConfigField] !== undefined) {
      (acc as Record<string, unknown>)[field] = payload[field as MutableConfigField];
    }

    return acc;
  }, {});

export const configService = {
  async ensureDefault(serverId: string | Types.ObjectId, overrides: Partial<IServerMaintenanceConfig> = {}) {
    const server = new Types.ObjectId(String(serverId));
    const existing = await ServerMaintenanceConfig.findOne({ server });
    if (existing) {
      const missingDefaults = pickConfigPayload(defaultMaintenanceConfig as Partial<IServerMaintenanceConfig>);
      const backfill = Object.entries(missingDefaults).reduce<Record<string, unknown>>((acc, [field, value]) => {
        if ((existing as any)[field] === undefined) {
          acc[field] = value;
        }
        return acc;
      }, {});

      if (Object.keys(backfill).length && !Object.keys(overrides).length) {
        return ServerMaintenanceConfig.findOneAndUpdate(
          { server },
          { ...backfill, updated: new Date() },
          { new: true }
        );
      }

      if (Object.keys(overrides).length) {
        return ServerMaintenanceConfig.findOneAndUpdate(
          { server },
          { ...backfill, ...pickConfigPayload(overrides), updated: new Date() },
          { new: true }
        );
      }

      return existing;
    }

    return ServerMaintenanceConfig.create({
      ...defaultMaintenanceConfig,
      ...pickConfigPayload(overrides),
      server,
      created: new Date(),
      updated: new Date(),
    });
  },

  async get(serverId: string) {
    const config = await this.ensureDefault(serverId);
    if (!config) {
      throw new AppError('Configuration not found.', HTTP_STATUS.NOT_FOUND);
    }

    return config;
  },

  async save(serverId: string, payload: Partial<IServerMaintenanceConfig>) {
    const config = await this.ensureDefault(serverId, payload);
    if (!config) {
      throw new AppError('Configuration not found.', HTTP_STATUS.NOT_FOUND);
    }

    return config;
  },

  async markPredictionRun(serverId: string | Types.ObjectId, executedAt = new Date()) {
    return ServerMaintenanceConfig.findOneAndUpdate(
      { server: new Types.ObjectId(String(serverId)) },
      { lastPredictionRunAt: executedAt, updated: new Date() },
      { new: true }
    );
  },

  async markCleanupRun(serverId: string | Types.ObjectId, executedAt = new Date()) {
    return ServerMaintenanceConfig.findOneAndUpdate(
      { server: new Types.ObjectId(String(serverId)) },
      { lastCleanupRunAt: executedAt, updated: new Date() },
      { new: true }
    );
  },

  async markCleanupRunStarted(serverId: string | Types.ObjectId, startedAt = new Date()) {
    return ServerMaintenanceConfig.findOneAndUpdate(
      { server: new Types.ObjectId(String(serverId)) },
      { cleanupRunStartedAt: startedAt, updated: new Date() },
      { new: true }
    );
  },

  async markCleanupRunCompleted(serverId: string | Types.ObjectId, completedAt = new Date()) {
    return ServerMaintenanceConfig.findOneAndUpdate(
      { server: new Types.ObjectId(String(serverId)) },
      { cleanupRunCompletedAt: completedAt, lastCleanupRunAt: completedAt, updated: new Date() },
      { new: true }
    );
  },
};
