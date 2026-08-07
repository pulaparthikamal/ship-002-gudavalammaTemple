import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export interface IProcessHealthSnapshot {
  pid: string;
  ppid?: string;
  state: string;
  cpuPercent: number;
  memoryPercent: number;
  name: string;
}

export interface IFilesystemUsageSnapshot {
  mount: string;
  filesystem: string;
  usedBytes: number;
  totalBytes: number;
  usagePercent: number;
}

export interface ICounterSnapshot {
  cpuTotal: number;
  cpuIdle: number;
  diskReadSectors: number;
  diskWriteSectors: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

export interface IMetricsHistory extends BaseDocument {
  server: Types.ObjectId;
  os: {
    id: string;
    name: string;
    version?: string;
    kernel?: string;
    hostname?: string;
    systemdAvailable: boolean;
    journaldAvailable: boolean;
  };
  cpuUsagePercent: number;
  cpuDeltaPercent?: number;
  trend?: 'up' | 'down' | 'stable';
  isSpike?: boolean;
  spikeSeverity?: 'low' | 'medium' | 'high';
  probableReason?: string;
  cpuCoreCount?: number;
  loadAverage: number;
  memoryUsagePercent: number;
  memoryUsedBytes?: number;
  memoryFreeBytes?: number;
  memoryCachedBytes?: number;
  swapUsagePercent: number;
  diskUsagePercent: number;
  diskReadBytesPerSecond: number;
  diskWriteBytesPerSecond: number;
  filesystemGrowthBytesPerMinute: number;
  networkRxBytesPerSecond: number;
  networkTxBytesPerSecond: number;
  networkErrors?: number;
  networkDroppedPackets?: number;
  serviceSummary: {
    running: number;
    failed: number;
    inactive: number;
    failedServices: string[];
    runningServices?: string[];
    inactiveServices?: string[];
    serviceIssues?: {
      service: string;
      manager: 'systemd' | 'pm2' | 'docker';
      status: 'failed' | 'inactive' | 'stopped' | 'exited' | 'unhealthy' | 'unknown';
      reason: string;
    }[];
  };
  processSummary: {
    total: number;
    zombies: number;
    blocked: number;
    topCpu: IProcessHealthSnapshot[];
  };
  sshSessionActivity: {
    loggedInUsers: number;
    establishedSessions: number;
    recentAuthWarnings: number;
  };
  filesystems: IFilesystemUsageSnapshot[];
  rawCounters: ICounterSnapshot;
  collectedAt: Date;
  pollIntervalMs: number;
  created: Date;
  createdAt?: Date;
}

const processHealthSchema = new Schema<IProcessHealthSnapshot>(
  {
    pid: { type: String, required: true },
    ppid: { type: String },
    state: { type: String, default: '' },
    cpuPercent: { type: Number, default: 0 },
    memoryPercent: { type: Number, default: 0 },
    name: { type: String, required: true },
  },
  { _id: false },
);

const filesystemUsageSchema = new Schema<IFilesystemUsageSnapshot>(
  {
    mount: { type: String, required: true },
    filesystem: { type: String, required: true },
    usedBytes: { type: Number, default: 0 },
    totalBytes: { type: Number, default: 0 },
    usagePercent: { type: Number, default: 0 },
  },
  { _id: false },
);

const metricsHistorySchema = new Schema<IMetricsHistory>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    os: {
      id: { type: String, default: 'linux' },
      name: { type: String, default: 'Linux' },
      version: { type: String },
      kernel: { type: String },
      hostname: { type: String },
      systemdAvailable: { type: Boolean, default: false },
      journaldAvailable: { type: Boolean, default: false },
    },
    cpuUsagePercent: { type: Number, default: 0, index: true },
    cpuDeltaPercent: { type: Number, default: 0 },
    trend: { type: String, enum: ['up', 'down', 'stable'], default: 'stable', index: true },
    isSpike: { type: Boolean, default: false, index: true },
    spikeSeverity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    probableReason: { type: String, default: 'No clear process-level cause found.' },
    cpuCoreCount: { type: Number, default: 0 },
    loadAverage: { type: Number, default: 0 },
    memoryUsagePercent: { type: Number, default: 0, index: true },
    memoryUsedBytes: { type: Number, default: 0 },
    memoryFreeBytes: { type: Number, default: 0 },
    memoryCachedBytes: { type: Number, default: 0 },
    swapUsagePercent: { type: Number, default: 0 },
    diskUsagePercent: { type: Number, default: 0, index: true },
    diskReadBytesPerSecond: { type: Number, default: 0 },
    diskWriteBytesPerSecond: { type: Number, default: 0 },
    filesystemGrowthBytesPerMinute: { type: Number, default: 0 },
    networkRxBytesPerSecond: { type: Number, default: 0 },
    networkTxBytesPerSecond: { type: Number, default: 0 },
    networkErrors: { type: Number, default: 0 },
    networkDroppedPackets: { type: Number, default: 0 },
    serviceSummary: {
      running: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      inactive: { type: Number, default: 0 },
      failedServices: { type: [String], default: [] },
      runningServices: { type: [String], default: [] },
      inactiveServices: { type: [String], default: [] },
      serviceIssues: {
        type: [
          new Schema(
            {
              service: { type: String, required: true },
              manager: { type: String, enum: ['systemd', 'pm2', 'docker'], required: true },
              status: {
                type: String,
                enum: ['failed', 'inactive', 'stopped', 'exited', 'unhealthy', 'unknown'],
                required: true,
              },
              reason: { type: String, required: true },
            },
            { _id: false },
          ),
        ],
        default: [],
      },
    },
    processSummary: {
      total: { type: Number, default: 0 },
      zombies: { type: Number, default: 0 },
      blocked: { type: Number, default: 0 },
      topCpu: { type: [processHealthSchema], default: [] },
    },
    sshSessionActivity: {
      loggedInUsers: { type: Number, default: 0 },
      establishedSessions: { type: Number, default: 0 },
      recentAuthWarnings: { type: Number, default: 0 },
    },
    filesystems: { type: [filesystemUsageSchema], default: [] },
    rawCounters: {
      cpuTotal: { type: Number, default: 0 },
      cpuIdle: { type: Number, default: 0 },
      diskReadSectors: { type: Number, default: 0 },
      diskWriteSectors: { type: Number, default: 0 },
      networkRxBytes: { type: Number, default: 0 },
      networkTxBytes: { type: Number, default: 0 },
    },
    collectedAt: { type: Date, default: Date.now, index: true },
    pollIntervalMs: { type: Number, default: 60000 },
    created: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'metrics_history',
  },
);

metricsHistorySchema.index({ server: 1, collectedAt: -1 });
metricsHistorySchema.index({ server: 1, collectedAt: 1 });

export const MetricsHistory = model<IMetricsHistory>('MetricsHistory', metricsHistorySchema);
