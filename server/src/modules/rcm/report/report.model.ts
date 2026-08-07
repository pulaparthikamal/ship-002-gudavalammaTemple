import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IReport extends BaseDocument {
  reportId: ObjectIdType;
  reportName?: string;
  reportType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  payerId?: string;
  providerId?: ObjectIdType;
  facilityId?: ObjectIdType;
  generatedBy?: string;
  generatedAt?: Date;
  exportFormat?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IReportModel extends Model<IReport> {
  list(criteria: any): Promise<IReport[]>;
  totalCount(criteria: any): Promise<number>;
}

const reportSchema = new Schema<IReport, IReportModel>(
  {
    reportId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    reportName: { type: String, trim: true },
    reportType: { type: String, trim: true },
    dateFrom: { type: Date },
    dateTo: { type: Date },
    payerId: { type: String, trim: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility' },
    generatedBy: { type: String, trim: true },
    generatedAt: { type: Date },
    exportFormat: { type: String, trim: true },
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

reportSchema.virtual('createdAt').get(function () {
  return this.created;
});

reportSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

reportSchema.index({ isDeleted: 1, updated: -1 });
reportSchema.index({ reportName: 1 });
reportSchema.index({ reportType: 1 });

reportSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

reportSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Report = model<IReport, IReportModel>('Report', reportSchema);
