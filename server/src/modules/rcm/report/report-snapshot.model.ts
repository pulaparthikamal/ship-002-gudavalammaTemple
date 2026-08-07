import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export interface IReportSnapshot extends BaseDocument {
  snapshotId: mongoose.Types.ObjectId;
  reportType: string;
  filterHash: string;
  filters?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  lastRefreshedAt?: Date;
  refreshStatus?: 'FRESH' | 'STALE' | 'REFRESHING' | 'FAILED';
  refreshError?: string;
  expiresAt?: Date;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: string;
  updatedBy?: string;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IReportSnapshotModel extends Model<IReportSnapshot> {}

const reportSnapshotSchema = new Schema<IReportSnapshot, IReportSnapshotModel>(
  {
    snapshotId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    reportType: { type: String, trim: true, required: true, index: true },
    filterHash: { type: String, trim: true, required: true, index: true },
    filters: { type: Schema.Types.Mixed },
    payload: { type: Schema.Types.Mixed },
    lastRefreshedAt: { type: Date },
    refreshStatus: { type: String, trim: true, default: 'FRESH', index: true },
    refreshError: { type: String, trim: true },
    expiresAt: { type: Date, index: true },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: String, trim: true },
    updatedBy: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

reportSnapshotSchema.index({ reportType: 1, filterHash: 1 }, { unique: true });
reportSnapshotSchema.index({ isDeleted: 1, refreshStatus: 1, updated: -1 });

export const ReportSnapshot = model<IReportSnapshot, IReportSnapshotModel>('ReportSnapshot', reportSnapshotSchema);
