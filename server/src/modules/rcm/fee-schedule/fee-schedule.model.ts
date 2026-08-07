import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IFeeSchedule extends BaseDocument {
  feeScheduleId: ObjectIdType;
  payerId: string;
  cptCode: string;
  modifiers?: string[];
  providerId?: ObjectIdType;
  facilityId?: ObjectIdType;
  state?: string;
  placeOfServiceCode?: string;
  planName?: string;
  groupNumber?: string;
  network?: string;
  coverageType?: string;
  allowedAmount: number;
  effectiveDate?: Date;
  expiryDate?: Date;
  active: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
}

export interface IFeeScheduleModel extends Model<IFeeSchedule> {
  list(criteria: any): Promise<IFeeSchedule[]>;
  totalCount(criteria: any): Promise<number>;
}

const feeScheduleSchema = new Schema<IFeeSchedule, IFeeScheduleModel>(
  {
    feeScheduleId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    payerId: { type: String, required: true, trim: true, index: true },
    cptCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    modifiers: { type: [String], default: [] },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', index: true },
    state: { type: String, trim: true, uppercase: true, index: true },
    placeOfServiceCode: { type: String, trim: true, index: true },
    planName: { type: String, trim: true, index: true },
    groupNumber: { type: String, trim: true, index: true },
    network: { type: String, trim: true, index: true },
    coverageType: { type: String, trim: true, index: true },
    allowedAmount: { type: Number, required: true },
    effectiveDate: { type: Date },
    expiryDate: { type: Date },
    active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

feeScheduleSchema.index({
  payerId: 1,
  cptCode: 1,
  modifiers: 1,
  providerId: 1,
  facilityId: 1,
  state: 1,
  placeOfServiceCode: 1,
  planName: 1,
  groupNumber: 1,
  network: 1,
  coverageType: 1,
  effectiveDate: -1,
});
feeScheduleSchema.index({ payerId: 1, cptCode: 1, active: 1, isDeleted: 1 });

feeScheduleSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

feeScheduleSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const FeeSchedule = model<IFeeSchedule, IFeeScheduleModel>('FeeSchedule', feeScheduleSchema);
