import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type MetricNamespace =
  | 'System'
  | 'CPU'
  | 'Memory'
  | 'Disk'
  | 'Network'
  | 'Process'
  | 'Application'
  | 'Security'
  | 'Docker';

export type MetricAggregation = 'avg' | 'min' | 'max' | 'sum' | 'count';
export type MetricGranularity = '1m' | '5m' | '15m' | '1h' | '1d';

export interface IMetricSeries extends BaseDocument {
  server: Types.ObjectId;
  namespace: MetricNamespace;
  metricName: string;
  value: number;
  unit: string;
  dimensions: Record<string, unknown>;
  collectedAt: Date;
  granularity: MetricGranularity;
  metadata: Record<string, unknown>;
  createdAt: Date;
  expireAt: Date;
}

const metricSeriesSchema = new Schema<IMetricSeries>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    namespace: {
      type: String,
      enum: ['System', 'CPU', 'Memory', 'Disk', 'Network', 'Process', 'Application', 'Security', 'Docker'],
      required: true,
      index: true,
    },
    metricName: { type: String, required: true, index: true },
    value: { type: Number, required: true },
    unit: { type: String, default: 'count' },
    dimensions: { type: Schema.Types.Mixed, default: {} },
    collectedAt: { type: Date, required: true, index: true },
    granularity: { type: String, enum: ['1m', '5m', '15m', '1h', '1d'], default: '1m' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    expireAt: { type: Date, default: () => new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) },
  },
  {
    timestamps: false,
    collection: 'metric_series',
  },
);

metricSeriesSchema.index({ server: 1, metricName: 1, collectedAt: 1 });
metricSeriesSchema.index({ namespace: 1, metricName: 1 });
metricSeriesSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const MetricSeries = model<IMetricSeries>('MetricSeries', metricSeriesSchema);
