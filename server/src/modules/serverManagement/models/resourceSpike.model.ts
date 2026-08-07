import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type ResourceSpikeMetric =
  | 'cpu'
  | 'memory'
  | 'swap'
  | 'disk'
  | 'load'
  | 'disk_io'
  | 'filesystem_growth'
  | 'network'
  | 'services'
  | 'processes'
  | 'ssh';

export interface IResourceSpike extends BaseDocument {
  server: Types.ObjectId;
  metric: ResourceSpikeMetric;
  severity: 'info' | 'warning' | 'critical';
  value: number;
  baseline: number;
  threshold: number;
  message: string;
  metadata: Record<string, unknown>;
  detectedAt: Date;
  created: Date;
}

const resourceSpikeSchema = new Schema<IResourceSpike>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    metric: {
      type: String,
      enum: [
        'cpu',
        'memory',
        'swap',
        'disk',
        'load',
        'disk_io',
        'filesystem_growth',
        'network',
        'services',
        'processes',
        'ssh',
      ],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ['info', 'warning', 'critical'], required: true, index: true },
    value: { type: Number, required: true },
    baseline: { type: Number, default: 0 },
    threshold: { type: Number, required: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    detectedAt: { type: Date, default: Date.now, index: true },
    created: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'resource_spikes',
  },
);

resourceSpikeSchema.index({ server: 1, metric: 1, detectedAt: -1 });

export const ResourceSpike = model<IResourceSpike>('ResourceSpike', resourceSpikeSchema);
