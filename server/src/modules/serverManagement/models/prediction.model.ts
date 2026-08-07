import mongoose, { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type PredictionSeverity = 'low' | 'medium' | 'high' | 'critical' | 'warning';

export interface IPredictionEvidence {
  source: 'metric' | 'trend' | 'event' | 'anomaly';
  title: string;
  detail: string;
  severity: PredictionSeverity;
  timestamp?: Date;
  metadata: Record<string, unknown>;
}

export interface IPredictionResult {
  issue: string;
  predictedFailure: string;
  recommendation: string;
  rootCauseAnalysis?: string;
  severity: PredictionSeverity;
  confidence: number;
  horizonMinutes: number;
  evidence: IPredictionEvidence[];
  recommendedActions: string[];
  affectedComponents: string[];
  impactedServices: string[];
  impactedDirectories: string[];
  timeframe?: string;
}

export interface IPredictionFeedback {
  rating: number;
  comment?: string;
  created: Date;
}

export interface IPrediction extends BaseDocument {
  server: Types.ObjectId;
  serverName: string;
  healthScore: number;
  predictions: IPredictionResult[];
  metricsSummary: Record<string, unknown>;
  trendAnalysis: Record<string, unknown>;
  aiGeneratedResponse: boolean;
  timeWindow: {
    start: Date;
    end: Date;
    minutes: number;
  };
  feedback: IPredictionFeedback[];
  created: Date;
  updated: Date;
}

const predictionEvidenceSchema = new Schema<IPredictionEvidence>(
  {
    source: { type: String, required: true },
    title: { type: String, required: true },
    detail: { type: String, required: true },
    severity: { type: String, required: true },
    timestamp: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const predictionResultSchema = new Schema<IPredictionResult>(
  {
    issue: { type: String, required: true },
    predictedFailure: { type: String, default: '' },
    recommendation: { type: String, default: '' },
    rootCauseAnalysis: { type: String },
    severity: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    horizonMinutes: { type: Number, required: true, min: 0 },
    evidence: { type: [predictionEvidenceSchema], default: [] },
    recommendedActions: { type: [String], default: [] },
    affectedComponents: { type: [String], default: [] },
    impactedServices: { type: [String], default: [] },
    impactedDirectories: { type: [String], default: [] },
    timeframe: { type: String },
  },
  { _id: false },
);

const predictionFeedbackSchema = new Schema<IPredictionFeedback>(
  {
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    created: { type: Date, default: Date.now },
  },
  { _id: false },
);

const predictionSchema = new Schema<IPrediction>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    serverName: { type: String, required: true },
    healthScore: { type: Number, required: true, min: 0, max: 100, index: true },
    predictions: { type: [predictionResultSchema], default: [] },
    metricsSummary: { type: Schema.Types.Mixed, default: {} },
    trendAnalysis: { type: Schema.Types.Mixed, default: {} },
    aiGeneratedResponse: { type: Boolean, default: true },
    timeWindow: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
      minutes: { type: Number, required: true, min: 0 },
    },
    feedback: { type: [predictionFeedbackSchema], default: [] },
    created: { type: Date, default: Date.now, index: true },
    updated: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
    collection: 'predictions',
  },
);

predictionSchema.index({ server: 1, created: -1 });

export const Prediction = model<IPrediction>('Prediction', predictionSchema);
