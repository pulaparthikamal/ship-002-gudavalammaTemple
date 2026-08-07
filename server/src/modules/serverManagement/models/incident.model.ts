import mongoose, { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';
export type IncidentSeverity = 'info' | 'warning' | 'critical';

export interface IIncidentEvidence {
  source: 'alert' | 'metric' | 'log' | 'scan' | 'anomaly' | 'agent';
  type: string;
  title: string;
  detail: string;
  severity: IncidentSeverity | string;
  timestamp?: Date;
  metadata: Record<string, unknown>;
}

export interface IIncident extends BaseDocument {
  server: Types.ObjectId;
  incidentKey: string;
  status: IncidentStatus;
  title: string;
  summary: string;
  rootCause: string;
  evidence: IIncidentEvidence[];
  confidence: number;
  severity: IncidentSeverity;
  nextActions: string[];
  aiNarrative: string;
  correlatedAlerts: Types.ObjectId[];
  correlatedMetrics: Types.ObjectId[];
  correlatedLogs: Types.ObjectId[];
  correlatedScanResults: Types.ObjectId[];
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  windowStart: Date;
  windowEnd: Date;
  created: Date;
  updated: Date;
}

const incidentEvidenceSchema = new Schema<IIncidentEvidence>(
  {
    source: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    detail: { type: String, required: true },
    severity: { type: String, required: true },
    timestamp: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const incidentSchema = new Schema<IIncident>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    incidentKey: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'resolved'],
      default: 'open',
      index: true,
    },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    rootCause: { type: String, required: true },
    evidence: { type: [incidentEvidenceSchema], default: [] },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning', index: true },
    nextActions: { type: [String], default: [] },
    aiNarrative: { type: String, default: '' },
    correlatedAlerts: [{ type: Schema.Types.ObjectId, ref: 'Alert', index: true }],
    correlatedMetrics: [{ type: Schema.Types.ObjectId, ref: 'Metric', index: true }],
    correlatedLogs: [{ type: Schema.Types.ObjectId, ref: 'MaintenanceLog', index: true }],
    correlatedScanResults: [{ type: Schema.Types.ObjectId, ref: 'ScanResult', index: true }],
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
    windowStart: { type: Date, required: true, index: true },
    windowEnd: { type: Date, required: true, index: true },
    created: { type: Date, default: Date.now, index: true },
    updated: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
    collection: 'incidents',
  }
);

incidentSchema.index({ server: 1, incidentKey: 1, status: 1 });

export const Incident = model<IIncident>('Incident', incidentSchema);
