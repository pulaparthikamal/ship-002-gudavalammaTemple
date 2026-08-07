import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type SupportedLogSource =
  | 'syslog'
  | 'auth'
  | 'nginx'
  | 'apache'
  | 'application'
  | 'docker'
  | 'kernel'
  | 'journald';

export type LogSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'SECURITY';

export interface ILogRaw extends BaseDocument {
  server: Types.ObjectId;
  source: SupportedLogSource;
  path?: string;
  line: string;
  fingerprint: string;
  observedAt: Date;
  collectedAt: Date;
  metadata: Record<string, unknown>;
}

export interface ILogProcessed extends BaseDocument {
  rawLog?: Types.ObjectId;
  server: Types.ObjectId;
  source: SupportedLogSource;
  logType?: string;
  severity: LogSeverity;
  rawMessage: string;
  normalizedPattern: string;
  displayMessage: string;
  message?: string;
  normalizedMessage?: string;
  timestamp: Date;
  service?: string;
  serviceName?: string;
  host?: string;
  pid?: string;
  processId?: string;
  actor?: string;
  ipAddress?: string;
  filePath?: string;
  category: string;
  tags: string[];
  parsedFields?: Record<string, unknown>;
  confidence: number;
  rootCauseSuggestion?: string;
  fingerprint: string;
  metadata: Record<string, unknown>;
  processedAt: Date;
}

export interface IIncidentPattern extends BaseDocument {
  server: Types.ObjectId;
  fingerprint: string;
  severity: LogSeverity;
  source: SupportedLogSource;
  title: string;
  summary: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  affectedServices: string[];
  sampleMessages: string[];
  rootCauseSuggestions: string[];
  status: 'open' | 'monitoring' | 'resolved';
  updatedAt: Date;
  createdAt: Date;
}

export interface IArchivedLog extends BaseDocument {
  server: Types.ObjectId;
  source: SupportedLogSource;
  originalPath?: string;
  archivePath?: string;
  archivedAt?: Date;
  status: 'recommended' | 'archived' | 'failed';
  reason: string;
  retentionDays: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ILogCleanupHistory extends BaseDocument {
  server: Types.ObjectId;
  action: 'archive_recommended' | 'delete_recommended' | 'policy_evaluated';
  status: 'recommended' | 'skipped' | 'failed';
  source?: SupportedLogSource;
  target?: string;
  reason: string;
  retentionDays: number;
  recommendedAt: Date;
  executedAt?: Date;
  executedBy?: string;
  auditTrail: string[];
  metadata: Record<string, unknown>;
}

const logRawSchema = new Schema<ILogRaw>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    source: {
      type: String,
      enum: ['syslog', 'auth', 'nginx', 'apache', 'application', 'docker', 'kernel', 'journald'],
      required: true,
      index: true,
    },
    path: { type: String },
    line: { type: String, required: true },
    fingerprint: { type: String, required: true, index: true },
    observedAt: { type: Date, required: true, index: true },
    collectedAt: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { collection: 'logs_raw', timestamps: false },
);

const logProcessedSchema = new Schema<ILogProcessed>(
  {
    rawLog: { type: Schema.Types.ObjectId, ref: 'LogRaw' },
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    source: {
      type: String,
      enum: ['syslog', 'auth', 'nginx', 'apache', 'application', 'docker', 'kernel', 'journald'],
      required: true,
      index: true,
    },
    logType: { type: String, index: true },
    severity: { type: String, enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'SECURITY'], required: true, index: true },
    rawMessage: { type: String, required: true },
    normalizedPattern: { type: String, required: true },
    displayMessage: { type: String, required: true },
    message: { type: String },
    normalizedMessage: { type: String },
    timestamp: { type: Date, required: true, index: true },
    service: { type: String, index: true },
    serviceName: { type: String, index: true },
    host: { type: String },
    pid: { type: String },
    processId: { type: String },
    actor: { type: String },
    ipAddress: { type: String, index: true },
    filePath: { type: String, index: true },
    category: { type: String, default: 'general', index: true },
    tags: { type: [String], default: [] },
    parsedFields: { type: Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 0.7 },
    rootCauseSuggestion: { type: String },
    fingerprint: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    processedAt: { type: Date, default: Date.now, index: true },
  },
  { collection: 'logs_processed', timestamps: false },
);

const incidentPatternSchema = new Schema<IIncidentPattern>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    fingerprint: { type: String, required: true, index: true },
    severity: { type: String, enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'SECURITY'], required: true, index: true },
    source: {
      type: String,
      enum: ['syslog', 'auth', 'nginx', 'apache', 'application', 'docker', 'kernel', 'journald'],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true, index: true },
    occurrenceCount: { type: Number, default: 1 },
    affectedServices: { type: [String], default: [] },
    sampleMessages: { type: [String], default: [] },
    rootCauseSuggestions: { type: [String], default: [] },
    status: { type: String, enum: ['open', 'monitoring', 'resolved'], default: 'open', index: true },
    updatedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'incident_patterns', timestamps: false },
);

const archivedLogSchema = new Schema<IArchivedLog>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    source: {
      type: String,
      enum: ['syslog', 'auth', 'nginx', 'apache', 'application', 'docker', 'kernel', 'journald'],
      required: true,
      index: true,
    },
    originalPath: { type: String },
    archivePath: { type: String },
    archivedAt: { type: Date },
    status: { type: String, enum: ['recommended', 'archived', 'failed'], default: 'recommended', index: true },
    reason: { type: String, required: true },
    retentionDays: { type: Number, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'archived_logs', timestamps: false },
);

const logCleanupHistorySchema = new Schema<ILogCleanupHistory>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    action: {
      type: String,
      enum: ['archive_recommended', 'delete_recommended', 'policy_evaluated'],
      required: true,
      index: true,
    },
    status: { type: String, enum: ['recommended', 'skipped', 'failed'], required: true, index: true },
    source: {
      type: String,
      enum: ['syslog', 'auth', 'nginx', 'apache', 'application', 'docker', 'kernel', 'journald'],
    },
    target: { type: String },
    reason: { type: String, required: true },
    retentionDays: { type: Number, required: true },
    recommendedAt: { type: Date, default: Date.now, index: true },
    executedAt: { type: Date },
    executedBy: { type: String },
    auditTrail: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { collection: 'log_cleanup_history', timestamps: false },
);

logRawSchema.index({ server: 1, fingerprint: 1 }, { unique: true });
logProcessedSchema.index({ server: 1, severity: 1, timestamp: -1 });
logProcessedSchema.index({ server: 1, timestamp: -1 });
logProcessedSchema.index({ server: 1, source: 1, timestamp: -1 });
logProcessedSchema.index({ server: 1, serviceName: 1, timestamp: -1 });
logProcessedSchema.index({ server: 1, fingerprint: 1, timestamp: -1 });
logProcessedSchema.index({ server: 1, normalizedPattern: 1, timestamp: -1 });
incidentPatternSchema.index({ server: 1, fingerprint: 1 }, { unique: true });
logCleanupHistorySchema.index({ server: 1, recommendedAt: -1 });

export const LogRaw = model<ILogRaw>('LogRaw', logRawSchema);
export const LogProcessed = model<ILogProcessed>('LogProcessed', logProcessedSchema);
export const IncidentPattern = model<IIncidentPattern>('IncidentPattern', incidentPatternSchema);
export const ArchivedLog = model<IArchivedLog>('ArchivedLog', archivedLogSchema);
export const LogCleanupHistory = model<ILogCleanupHistory>('LogCleanupHistory', logCleanupHistorySchema);
