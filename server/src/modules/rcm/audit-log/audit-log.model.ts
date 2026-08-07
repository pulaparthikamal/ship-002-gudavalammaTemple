import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IAuditLog extends BaseDocument {
  auditId: ObjectIdType;
  entityType?: string;
  entityId?: ObjectIdType | string;
  action?: string;
  userId?: ObjectIdType | string;
  userName?: string;
  previousState?: any;
  newState?: any;
  reason?: string;
  source?: string;
  correlationId?: string;
  claimId?: ObjectIdType | string;
  submissionId?: ObjectIdType | string;
  financialEventId?: ObjectIdType | string;
  appointmentId?: ObjectIdType | string;
  patientId?: ObjectIdType | string;
  payerId?: string;
  severity?: string;
  category?: string;
  visibility?: string;
  status?: string;
  userAgent?: string;
  retentionClass?: string;
  retentionUntil?: Date;
  legalHold?: boolean;
  redactionVersion?: string;
  fieldName?: string;
  oldValue?: any;
  newValue?: any;
  changedBy?: string;
  timestamp?: Date;
  sourceModule?: string;
  ipAddress?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IAuditLogModel extends Model<IAuditLog> {
  list(criteria: any): Promise<IAuditLog[]>;
  totalCount(criteria: any): Promise<number>;
}

const auditLogSchema = new Schema<IAuditLog, IAuditLogModel>(
  {
    auditId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    entityType: { type: String, trim: true },
    entityId: { type: Schema.Types.Mixed },
    action: { type: String, trim: true },
    userId: { type: Schema.Types.Mixed },
    userName: { type: String, trim: true },
    previousState: { type: Schema.Types.Mixed },
    newState: { type: Schema.Types.Mixed },
    reason: { type: String, trim: true },
    source: { type: String, trim: true },
    correlationId: { type: String, trim: true },
    claimId: { type: Schema.Types.Mixed },
    submissionId: { type: Schema.Types.Mixed },
    financialEventId: { type: Schema.Types.Mixed },
    appointmentId: { type: Schema.Types.Mixed },
    patientId: { type: Schema.Types.Mixed },
    payerId: { type: String, trim: true },
    severity: { type: String, trim: true, default: 'INFO' },
    category: { type: String, trim: true, default: 'CLAIM' },
    visibility: { type: String, trim: true, default: 'OPERATIONAL_VISIBLE' },
    status: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    retentionClass: { type: String, trim: true, default: 'RCM_AUDIT' },
    retentionUntil: { type: Date },
    legalHold: { type: Boolean, default: false },
    redactionVersion: { type: String, trim: true, default: 'v1' },
    fieldName: { type: String, trim: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    changedBy: { type: String, trim: true },
    timestamp: { type: Date },
    sourceModule: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.Mixed },
    updatedBy: { type: Schema.Types.Mixed },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

auditLogSchema.virtual('createdAt').get(function () {
  return this.created;
});

auditLogSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

auditLogSchema.index({ isDeleted: 1, updated: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ claimId: 1, timestamp: -1 });
auditLogSchema.index({ appointmentId: 1, timestamp: -1 });
auditLogSchema.index({ patientId: 1, timestamp: -1 });
auditLogSchema.index({ payerId: 1, timestamp: -1 });
auditLogSchema.index({ correlationId: 1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, timestamp: -1 });
auditLogSchema.index({ visibility: 1, timestamp: -1 });
auditLogSchema.index({ retentionUntil: 1 }, { sparse: true });

function blockAuditMutation(next: (error?: Error) => void) {
  next(new Error('Audit logs are append-only and cannot be mutated.'));
}

auditLogSchema.pre('updateOne', blockAuditMutation);
auditLogSchema.pre('updateMany', blockAuditMutation);
auditLogSchema.pre('findOneAndUpdate', blockAuditMutation);
auditLogSchema.pre('deleteOne', blockAuditMutation);
auditLogSchema.pre('deleteMany', blockAuditMutation);
auditLogSchema.pre('findOneAndDelete', blockAuditMutation);

auditLogSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

auditLogSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const AuditLog = model<IAuditLog, IAuditLogModel>('AuditLog', auditLogSchema);
