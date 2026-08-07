import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareReportHistory extends BaseDocument {
  reportHistoryId: ObjectIdType;
  period: 'weekly' | 'monthly';
  report: Record<string, unknown>;
  generatedAt: Date;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareReportHistoryModel extends Model<IMineCareReportHistory> {
  list(criteria: any): Promise<IMineCareReportHistory[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareReportHistorySchema = new Schema<IMineCareReportHistory, IMineCareReportHistoryModel>(
  {
    reportHistoryId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    period: { type: String, enum: ['weekly', 'monthly'], required: true },
    report: { type: Schema.Types.Mixed, required: true },
    generatedAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

mineCareReportHistorySchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareReportHistorySchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareReportHistorySchema.index({ period: 1, generatedAt: -1, isDeleted: 1 });
mineCareReportHistorySchema.index({ isDeleted: 1, updated: -1 });

mineCareReportHistorySchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareReportHistorySchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareReportHistory = model<IMineCareReportHistory, IMineCareReportHistoryModel>('MineCareReportHistory', mineCareReportHistorySchema);
