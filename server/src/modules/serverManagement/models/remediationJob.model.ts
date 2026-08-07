import { Schema, model, Document, Types } from 'mongoose';

export type RemediationType =
  | 'restart_service'
  | 'kill_process'
  | 'clear_cache'
  | 'rollback'
  | 'delete_file'
  | 'archive_file'
  | 'custom_command'
  | 'agent_plan';

export type RemediationPlanningMode = 'static' | 'agent';
export type RemediationRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RemediationToolName =
  | 'collect_metrics'
  | 'run_health_check'
  | 'start_scan'
  | 'analyze_scan_results'
  | 'apply_scan_cleanup'
  | 'safe_system_optimization'
  | 'restart_service'
  | 'kill_process'
  | 'clear_cache'
  | 'delete_file'
  | 'archive_file'
  | 'custom_command';

export type RemediationStatus =
  | 'planned'
  | 'pending_approval'
  | 'queued'
  | 'running'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'skipped'
  | 'rolled_back'
  | 'cancelled';

export interface IRemediationStep {
  name: string;
  command?: string;
  toolName?: RemediationToolName;
  toolArgs?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface IRemediationJob extends Document {
  server: Types.ObjectId;
  type: RemediationType;
  target: string; // service name, PID, path, etc.
  description: string;
  status: RemediationStatus;
  planningMode: RemediationPlanningMode;
  planner?: string;
  intent?: string;
  planningContext?: Record<string, any>;
  reasoningSummary?: string;
  decisionTrace: string[];
  riskLevel: RemediationRiskLevel;
  requiresApproval: boolean;
  
  // Relations
  incident?: Types.ObjectId;
  prediction?: Types.ObjectId;
  
  // Execution Plan
  steps: IRemediationStep[];
  rollbackSteps: IRemediationStep[];
  progressPercent?: number;
  currentStep?: string;
  lastProgressAt?: Date;
  
  // Health Checks
  preFlightCheck?: {
    status: 'passed' | 'failed';
    results: any;
    timestamp: Date;
  };
  postFlightCheck?: {
    status: 'passed' | 'failed';
    results: any;
    timestamp: Date;
  };
  executionSummary?: {
    scannedFiles?: number;
    candidatesFound?: number;
    filesDeleted?: number;
    filesArchived?: number;
    filesIgnored?: number;
    failedActions?: number;
    skippedActions?: number;
    spaceReclaimedMb?: number;
    remainingIssues?: number;
    scanId?: string;
    verification?: Record<string, any>;
    details?: any[];
    errors?: any[];
  };
  
  // Queue & Retry
  priority: 'low' | 'medium' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  
  // Audit
  plannedBy?: string; // User ID or 'system'
  approvedBy?: string;
  approvedAt?: Date;
  
  created: Date;
  updated: Date;
  startedAt?: Date;
  completedAt?: Date;
}

const remediationStepSchema = new Schema<IRemediationStep>({
  name: { type: String, required: true },
  command: { type: String },
  toolName: {
    type: String,
    enum: [
      'collect_metrics',
      'run_health_check',
      'start_scan',
      'analyze_scan_results',
      'apply_scan_cleanup',
      'safe_system_optimization',
      'restart_service',
      'kill_process',
      'clear_cache',
      'delete_file',
      'archive_file',
      'custom_command',
    ],
  },
  toolArgs: { type: Schema.Types.Mixed },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'skipped'], default: 'pending' },
  output: { type: String },
  error: { type: String },
  startedAt: { type: Date },
  completedAt: { type: Date },
});

const remediationJobSchema = new Schema<IRemediationJob>({
  server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true },
  type: { type: String, required: true },
  target: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, required: true, default: 'planned' },
  planningMode: { type: String, enum: ['static', 'agent'], default: 'static' },
  planner: { type: String },
  intent: { type: String },
  planningContext: { type: Schema.Types.Mixed },
  reasoningSummary: { type: String },
  decisionTrace: { type: [String], default: [] },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  requiresApproval: { type: Boolean, default: false },
  
  incident: { type: Schema.Types.ObjectId, ref: 'Incident' },
  prediction: { type: Schema.Types.ObjectId, ref: 'Prediction' },
  
  steps: [remediationStepSchema],
  rollbackSteps: [remediationStepSchema],
  progressPercent: { type: Number, min: 0, max: 100, default: 0 },
  currentStep: { type: String },
  lastProgressAt: { type: Date },
  
  preFlightCheck: {
    status: { type: String, enum: ['passed', 'failed'] },
    results: { type: Schema.Types.Mixed },
    timestamp: { type: Date },
  },
  postFlightCheck: {
    status: { type: String, enum: ['passed', 'failed'] },
    results: { type: Schema.Types.Mixed },
    timestamp: { type: Date },
  },
  executionSummary: { type: Schema.Types.Mixed },
  
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  lastError: { type: String },
  
  plannedBy: { type: String },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now },
  startedAt: { type: Date },
  completedAt: { type: Date },
});

remediationJobSchema.pre('save', function (next) {
  this.updated = new Date();
  next();
});

remediationJobSchema.index({ server: 1, status: 1, created: -1 });
remediationJobSchema.index({ server: 1, created: -1 });

export const RemediationJob = model<IRemediationJob>('RemediationJob', remediationJobSchema);
