import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IRule extends BaseDocument {
  ruleId: string;
  type: 'invalid_combination' | 'frequency_limit' | 'missing_required' | 'auth_required' | string;
  message: string;
  severity: 'error' | 'warning' | string;
  payerId?: string;
  providerId?: ObjectIdType;
  facilityId?: ObjectIdType;
  state?: string;
  placeOfServiceCode?: string;
  planName?: string;
  groupNumber?: string;
  network?: string;
  coverageType?: string;
  codes?: string[];
  code?: string;
  limit?: string;
  requiredFields?: string[];
  effectiveDate?: Date;
  expiryDate?: Date;
  active: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
}

export interface IRuleModel extends Model<IRule> {
  list(criteria: any): Promise<IRule[]>;
  totalCount(criteria: any): Promise<number>;
}

const ruleSchema = new Schema<IRule, IRuleModel>(
  {
    ruleId: { type: String, required: true, trim: true, unique: true, index: true },
    type: { type: String, required: true, trim: true, index: true },
    message: { type: String, required: true, trim: true },
    severity: { type: String, required: true, trim: true, index: true },
    payerId: { type: String, trim: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', index: true },
    state: { type: String, trim: true, uppercase: true, index: true },
    placeOfServiceCode: { type: String, trim: true, index: true },
    planName: { type: String, trim: true, index: true },
    groupNumber: { type: String, trim: true, index: true },
    network: { type: String, trim: true, index: true },
    coverageType: { type: String, trim: true, index: true },
    codes: { type: [String], default: undefined },
    code: { type: String, trim: true, index: true },
    limit: { type: String, trim: true },
    requiredFields: { type: [String], default: undefined },
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

ruleSchema.index({
  payerId: 1,
  code: 1,
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

ruleSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

ruleSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Rule = model<IRule, IRuleModel>('Rule', ruleSchema);
