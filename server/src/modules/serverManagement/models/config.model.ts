import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';
import { FileCategory, fileCategories } from './scanResult.model';

export interface IAutomationRule {
  enabled: boolean;
  action: 'delete' | 'archive' | 'ignore';
  category?: FileCategory;
  olderThanDays?: number;
  largerThanMb?: number;
  targetFolder?: string;
}

export interface IServerMaintenanceConfig extends BaseDocument {
  server: Types.ObjectId;
  diskThresholdPercent: number;
  cpuThresholdPercent: number;
  memoryThresholdPercent: number;
  scanFrequencyMinutes: number;
  predictionIntervalMinutes: number;
  unusedFileDays: number;
  largeFileMb: number;
  archiveOlderThanDays: number;
  deleteOlderThanDays: number;
  cleanupAutomationEnabled: boolean;
  cleanupFrequencyMinutes: number;
  archiveLargeFileMb: number;
  archiveDirectory: string;
  scanDirectories: string[];
  ignoreFolders: string[];
  tempPatterns: string[];
  logPatterns: string[];
  automationEnabled: boolean;
  rules: IAutomationRule[];
  lastPredictionRunAt?: Date;
  cleanupRunStartedAt?: Date;
  cleanupRunCompletedAt?: Date;
  lastCleanupRunAt?: Date;
  maxRestartAttempts: number;
  restartCooldownMinutes: number;
  slackWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  monitoredServices: string[];
  created: Date;
  updated: Date;
}

export const defaultMaintenanceConfig = {
  diskThresholdPercent: 60,
  cpuThresholdPercent: 85,
  memoryThresholdPercent: 85,
  scanFrequencyMinutes: 5,
  predictionIntervalMinutes: 180,
  unusedFileDays: 30,
  largeFileMb: 100,
  archiveOlderThanDays: 30,
  deleteOlderThanDays: 90,
  cleanupAutomationEnabled: false,
  cleanupFrequencyMinutes: 1440,
  archiveLargeFileMb: 250,
  archiveDirectory: '/tmp/ai-server-archives',
  scanDirectories: ['/tmp', '/var/log'],
  ignoreFolders: ['/proc', '/sys', '/dev', '/run'],
  tempPatterns: ['*.tmp', '*.temp', '*.cache'],
  logPatterns: ['*.log', '*.out'],
  automationEnabled: false,
  maxRestartAttempts: 3,
  restartCooldownMinutes: 5,
  rules: [
    {
      enabled: true,
      action: 'delete',
      category: 'logs',
      olderThanDays: 90,
    },
    {
      enabled: true,
      action: 'archive',
      category: 'large',
      largerThanMb: 250,
    },
    {
      enabled: true,
      action: 'delete',
      category: 'temp',
      olderThanDays: 30,
    },
    {
      enabled: true,
      action: 'delete',
      category: 'unused',
      olderThanDays: 90,
    },
  ],
};

const automationRuleSchema = new Schema<IAutomationRule>(
  {
    enabled: { type: Boolean, default: true },
    action: { type: String, enum: ['delete', 'archive', 'ignore'], required: true },
    category: { type: String, enum: fileCategories },
    olderThanDays: { type: Number },
    largerThanMb: { type: Number },
    targetFolder: { type: String },
  },
  { _id: false },
);

const configSchema = new Schema<IServerMaintenanceConfig>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, unique: true },
    diskThresholdPercent: { type: Number, default: defaultMaintenanceConfig.diskThresholdPercent },
    cpuThresholdPercent: { type: Number, default: defaultMaintenanceConfig.cpuThresholdPercent },
    memoryThresholdPercent: {
      type: Number,
      default: defaultMaintenanceConfig.memoryThresholdPercent,
    },
    scanFrequencyMinutes: { type: Number, default: defaultMaintenanceConfig.scanFrequencyMinutes },
    predictionIntervalMinutes: {
      type: Number,
      default: defaultMaintenanceConfig.predictionIntervalMinutes,
    },
    unusedFileDays: { type: Number, default: defaultMaintenanceConfig.unusedFileDays },
    largeFileMb: { type: Number, default: defaultMaintenanceConfig.largeFileMb },
    archiveOlderThanDays: { type: Number, default: defaultMaintenanceConfig.archiveOlderThanDays },
    deleteOlderThanDays: { type: Number, default: defaultMaintenanceConfig.deleteOlderThanDays },
    cleanupAutomationEnabled: {
      type: Boolean,
      default: defaultMaintenanceConfig.cleanupAutomationEnabled,
    },
    cleanupFrequencyMinutes: {
      type: Number,
      default: defaultMaintenanceConfig.cleanupFrequencyMinutes,
    },
    archiveLargeFileMb: { type: Number, default: defaultMaintenanceConfig.archiveLargeFileMb },
    archiveDirectory: { type: String, default: defaultMaintenanceConfig.archiveDirectory },
    scanDirectories: { type: [String], default: defaultMaintenanceConfig.scanDirectories },
    ignoreFolders: { type: [String], default: defaultMaintenanceConfig.ignoreFolders },
    tempPatterns: { type: [String], default: defaultMaintenanceConfig.tempPatterns },
    logPatterns: { type: [String], default: defaultMaintenanceConfig.logPatterns },
    automationEnabled: { type: Boolean, default: defaultMaintenanceConfig.automationEnabled },
    rules: { type: [automationRuleSchema], default: defaultMaintenanceConfig.rules } as any,
    lastPredictionRunAt: { type: Date },
    cleanupRunStartedAt: { type: Date },
    cleanupRunCompletedAt: { type: Date },
    lastCleanupRunAt: { type: Date },
    maxRestartAttempts: { type: Number, default: 3 },
    restartCooldownMinutes: { type: Number, default: 5 },
    slackWebhookUrl: { type: String },
    telegramBotToken: { type: String },
    telegramChatId: { type: String },
    monitoredServices: { type: [String], default: [] },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'configs',
  },
);

export const ServerMaintenanceConfig = model<IServerMaintenanceConfig>(
  'ServerMaintenanceConfig',
  configSchema,
);
