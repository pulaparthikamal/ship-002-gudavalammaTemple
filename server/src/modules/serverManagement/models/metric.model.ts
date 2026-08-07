import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export interface IMetric extends BaseDocument {
  server: Types.ObjectId;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  swapUsagePercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  loadAverage: number;
  cpuCores: number;
  cpuModel: string;
  gpuInfo: string;
  runningServicesCount: number;
  runningServices: string[];
  totalMemoryBytes: number;
  usedMemoryBytes: number;
  totalDiskBytes: number;
  usedDiskBytes: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
  diskReadIo: number;
  diskWriteIo: number;
  networkDownloadSpeed: number;
  networkUploadSpeed: number;
  networkTotalReceived: number;
  networkTotalSent: number;
  topProcesses: Array<{
    pid: string;
    cpu: number;
    mem: number;
    name: string;
    user: string;
  }>;
  collectedAt: Date;
  trigger: 'scheduled' | 'manual' | 'threshold';
  created: Date;
}

const metricSchema = new Schema<IMetric>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    cpuUsagePercent: { type: Number, required: true },
    memoryUsagePercent: { type: Number, required: true },
    diskUsagePercent: { type: Number, required: true },
    swapUsagePercent: { type: Number, default: 0 },
    networkRxBytes: { type: Number, default: 0 },
    networkTxBytes: { type: Number, default: 0 },
    loadAverage: { type: Number, default: 0 },
    cpuCores: { type: Number, default: 0 },
    cpuModel: { type: String, default: 'Unknown' },
    gpuInfo: { type: String, default: 'None' },
    runningServicesCount: { type: Number, default: 0 },
    runningServices: { type: [String], default: [] },
    totalMemoryBytes: { type: Number, default: 0 },
    usedMemoryBytes: { type: Number, default: 0 },
    totalDiskBytes: { type: Number, default: 0 },
    usedDiskBytes: { type: Number, default: 0 },
    swapTotalBytes: { type: Number, default: 0 },
    swapUsedBytes: { type: Number, default: 0 },
    diskReadIo: { type: Number, default: 0 },
    diskWriteIo: { type: Number, default: 0 },
    networkDownloadSpeed: { type: Number, default: 0 },
    networkUploadSpeed: { type: Number, default: 0 },
    networkTotalReceived: { type: Number, default: 0 },
    networkTotalSent: { type: Number, default: 0 },
    topProcesses: {
      type: [
        {
          pid: String,
          cpu: Number,
          mem: Number,
          name: String,
          user: String,
        },
      ],
      default: [],
    },
    collectedAt: { type: Date, default: Date.now, index: true },
    trigger: { type: String, enum: ['scheduled', 'manual', 'threshold'], default: 'scheduled' },
    created: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'metrics',
  }
);

metricSchema.index({ server: 1, collectedAt: -1 });

export const Metric = model<IMetric>('Metric', metricSchema);
