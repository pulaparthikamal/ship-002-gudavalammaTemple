import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type FileScanEventType = 'created' | 'modified';
export type FileScanStatus = 'pending' | 'scanning' | 'completed' | 'failed' | 'skipped' | 'marked_safe';
export type FileRiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';
export type FileRecommendedAction = 'allow' | 'review' | 'quarantine' | 'delete';
export type FileActionStatus = 'none' | 'backup_completed' | 'quarantined' | 'restore_completed' | 'delete_completed' | 'failed';
export type FileCategory =
  | 'source_code'
  | 'shell_script'
  | 'node_script'
  | 'python_script'
  | 'php_script'
  | 'config_file'
  | 'env_file'
  | 'credential_file'
  | 'private_key_file'
  | 'log_file'
  | 'html_file'
  | 'json_file'
  | 'yaml_file'
  | 'docker_file'
  | 'nginx_config'
  | 'apache_config'
  | 'systemd_service'
  | 'cron_file'
  | 'database_dump'
  | 'archive_file'
  | 'binary_file'
  | 'unknown';

export interface IFileScanEvent extends BaseDocument {
  server: Types.ObjectId;
  filePath: string;
  fileName: string;
  eventType: FileScanEventType;
  fileHash?: string;
  modifiedAt?: Date;
  scanStatus: FileScanStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface IFileScanResult extends BaseDocument {
  event?: Types.ObjectId;
  server: Types.ObjectId;
  filePath: string;
  fileName: string;
  extension?: string;
  detectedFileType?: string;
  fileCategory: FileCategory;
  typeConfidence: number;
  typeSignals: string[];
  mimeType?: string;
  fileSize: number;
  fileHash?: string;
  modifiedAt?: Date;
  permissions?: string;
  owner?: string;
  eventType: FileScanEventType;
  scanStatus: FileScanStatus;
  riskLevel: FileRiskLevel;
  riskScore: number;
  riskReasons: string[];
  detectedPatterns: string[];
  harmfulBehaviors: string[];
  recommendedAction: FileRecommendedAction;
  aiExplanation: string;
  backupStatus: FileActionStatus;
  backupPath?: string;
  compressedBackupPath?: string;
  backupHash?: string;
  quarantineStatus: FileActionStatus;
  quarantinePath?: string;
  actionStatus: FileActionStatus;
  actionError?: string;
  markedSafeAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuarantinedFile extends BaseDocument {
  server: Types.ObjectId;
  scanResult: Types.ObjectId;
  originalPath: string;
  quarantinePath: string;
  backupPath: string;
  riskLevel: FileRiskLevel;
  restoredAt?: Date;
  deletedAt?: Date;
  status: 'quarantined' | 'restored' | 'deleted' | 'failed';
  createdAt: Date;
}

export interface IFileBackupHistory extends BaseDocument {
  server: Types.ObjectId;
  scanResult?: Types.ObjectId;
  originalPath: string;
  backupPath: string;
  originalHash?: string;
  backupHash?: string;
  status: 'completed' | 'failed';
  reason: string;
  createdAt: Date;
}

export interface ISecurityAlert extends BaseDocument {
  server: Types.ObjectId;
  scanResult?: Types.ObjectId;
  filePath: string;
  riskLevel: FileRiskLevel;
  riskScore: number;
  message: string;
  actionTaken: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

const fileScanEventSchema = new Schema<IFileScanEvent>({
  server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
  filePath: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  eventType: { type: String, enum: ['created', 'modified'], required: true },
  fileHash: { type: String, index: true },
  modifiedAt: { type: Date, index: true },
  scanStatus: { type: String, enum: ['pending', 'scanning', 'completed', 'failed', 'skipped', 'marked_safe'], default: 'pending', index: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
}, { collection: 'file_scan_events', timestamps: false });

const fileScanResultSchema = new Schema<IFileScanResult>({
  event: { type: Schema.Types.ObjectId, ref: 'FileScanEvent' },
  server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
  filePath: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  extension: { type: String, index: true },
  detectedFileType: { type: String },
  fileCategory: {
    type: String,
    enum: [
      'source_code',
      'shell_script',
      'node_script',
      'python_script',
      'php_script',
      'config_file',
      'env_file',
      'credential_file',
      'private_key_file',
      'log_file',
      'html_file',
      'json_file',
      'yaml_file',
      'docker_file',
      'nginx_config',
      'apache_config',
      'systemd_service',
      'cron_file',
      'database_dump',
      'archive_file',
      'binary_file',
      'unknown',
    ],
    default: 'unknown',
    index: true,
  },
  typeConfidence: { type: Number, default: 0 },
  typeSignals: { type: [String], default: [] },
  mimeType: { type: String },
  fileSize: { type: Number, default: 0 },
  fileHash: { type: String, index: true },
  modifiedAt: { type: Date, index: true },
  permissions: { type: String },
  owner: { type: String },
  eventType: { type: String, enum: ['created', 'modified'], required: true },
  scanStatus: { type: String, enum: ['pending', 'scanning', 'completed', 'failed', 'skipped', 'marked_safe'], default: 'pending', index: true },
  riskLevel: { type: String, enum: ['safe', 'low', 'medium', 'high', 'critical'], default: 'safe', index: true },
  riskScore: { type: Number, default: 0 },
  riskReasons: { type: [String], default: [] },
  detectedPatterns: { type: [String], default: [] },
  harmfulBehaviors: { type: [String], default: [] },
  recommendedAction: { type: String, enum: ['allow', 'review', 'quarantine', 'delete'], default: 'allow' },
  aiExplanation: { type: String, default: '' },
  backupStatus: { type: String, enum: ['none', 'backup_completed', 'quarantined', 'restore_completed', 'delete_completed', 'failed'], default: 'none' },
  backupPath: { type: String },
  compressedBackupPath: { type: String },
  backupHash: { type: String },
  quarantineStatus: { type: String, enum: ['none', 'backup_completed', 'quarantined', 'restore_completed', 'delete_completed', 'failed'], default: 'none', index: true },
  quarantinePath: { type: String },
  actionStatus: { type: String, enum: ['none', 'backup_completed', 'quarantined', 'restore_completed', 'delete_completed', 'failed'], default: 'none' },
  actionError: { type: String },
  markedSafeAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'file_scan_results', timestamps: false });

const quarantinedFileSchema = new Schema<IQuarantinedFile>({
  server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
  scanResult: { type: Schema.Types.ObjectId, ref: 'FileScanResult', required: true, index: true },
  originalPath: { type: String, required: true, index: true },
  quarantinePath: { type: String, required: true },
  backupPath: { type: String, required: true },
  riskLevel: { type: String, enum: ['safe', 'low', 'medium', 'high', 'critical'], required: true, index: true },
  restoredAt: { type: Date },
  deletedAt: { type: Date },
  status: { type: String, enum: ['quarantined', 'restored', 'deleted', 'failed'], default: 'quarantined', index: true },
  createdAt: { type: Date, default: Date.now, index: true },
}, { collection: 'quarantined_files', timestamps: false });

const fileBackupHistorySchema = new Schema<IFileBackupHistory>({
  server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
  scanResult: { type: Schema.Types.ObjectId, ref: 'FileScanResult', index: true },
  originalPath: { type: String, required: true, index: true },
  backupPath: { type: String, required: true },
  originalHash: { type: String },
  backupHash: { type: String },
  status: { type: String, enum: ['completed', 'failed'], required: true, index: true },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
}, { collection: 'file_backup_history', timestamps: false });

const securityAlertSchema = new Schema<ISecurityAlert>({
  server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
  scanResult: { type: Schema.Types.ObjectId, ref: 'FileScanResult', index: true },
  filePath: { type: String, required: true, index: true },
  riskLevel: { type: String, enum: ['safe', 'low', 'medium', 'high', 'critical'], required: true, index: true },
  riskScore: { type: Number, default: 0 },
  message: { type: String, required: true },
  actionTaken: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
}, { collection: 'security_alerts', timestamps: false });

fileScanEventSchema.index({ server: 1, filePath: 1, modifiedAt: -1 });
fileScanResultSchema.index({ server: 1, riskLevel: 1, scanStatus: 1, createdAt: -1 });
fileScanResultSchema.index({ server: 1, filePath: 1, createdAt: -1 });
fileScanResultSchema.index({ server: 1, fileCategory: 1, createdAt: -1 });
quarantinedFileSchema.index({ server: 1, status: 1, createdAt: -1 });
fileBackupHistorySchema.index({ server: 1, originalPath: 1, createdAt: -1 });
securityAlertSchema.index({ server: 1, riskLevel: 1, createdAt: -1 });

export const FileScanEvent = model<IFileScanEvent>('FileScanEvent', fileScanEventSchema);
export const FileScanResult = model<IFileScanResult>('FileScanResult', fileScanResultSchema);
export const QuarantinedFile = model<IQuarantinedFile>('QuarantinedFile', quarantinedFileSchema);
export const FileBackupHistory = model<IFileBackupHistory>('FileBackupHistory', fileBackupHistorySchema);
export const SecurityAlert = model<ISecurityAlert>('SecurityAlert', securityAlertSchema);
