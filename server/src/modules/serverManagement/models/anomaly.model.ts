import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';
import type { PredictionSeverity } from './prediction.model';

export interface IAnomaly extends BaseDocument {
  server: Types.ObjectId;
  prediction?: Types.ObjectId;
  type: string;
  title: string;
  component: string;
  severity: PredictionSeverity;
  value: number;
  baseline: number;
  threshold: number;
  confidence: number;
  detector: 'threshold_statistical' | 'trend' | 'isolation_forest' | string;
  evidence: string[];
  metadata: Record<string, unknown>;
  detectedAt: Date;
  created: Date;
}

const anomalySchema = new Schema<IAnomaly>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    prediction: { type: Schema.Types.ObjectId, ref: 'Prediction', index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    component: { type: String, required: true, index: true },
    severity: { type: String, required: true, index: true },
    value: { type: Number, default: 0 },
    baseline: { type: Number, default: 0 },
    threshold: { type: Number, default: 0 },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    detector: { type: String, required: true, index: true },
    evidence: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    detectedAt: { type: Date, default: Date.now, index: true },
    created: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'anomalies',
  },
);

anomalySchema.index({ server: 1, detectedAt: -1 });

export const Anomaly = model<IAnomaly>('Anomaly', anomalySchema);
