import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export const COVERAGE_RULE_TYPES = [
  'AUTH_REQUIRED',
  'REFERRAL_REQUIRED',
  'NOT_COVERED',
  'COVERED',
  'MEDICAL_NECESSITY_REQUIRED',
  'AGE_LIMIT',
  'GENDER_LIMIT',
  'FREQUENCY_LIMIT',
  'DIAGNOSIS_REQUIRED',
  'MODIFIER_REQUIRED',
  'POS_RESTRICTED',
  'NETWORK_RESTRICTED',
] as const;

export const COVERAGE_RULE_SEVERITIES = ['WARNING', 'BLOCKING'] as const;

export interface ICoverageRule extends BaseDocument {
  coverageRuleId: ObjectIdType;
  payerId?: string;
  planName?: string;
  groupNumber?: string;
  state?: string;
  facilityId?: ObjectIdType;
  providerId?: ObjectIdType;
  cptCode?: string;
  diagnosisCodes?: string[];
  placeOfServiceCode?: string;
  network?: string;
  coverageType?: string;
  ruleType: string;
  severity?: string;
  ruleValue?: Record<string, unknown> | string | number | boolean;
  effectiveDate?: Date;
  expiryDate?: Date;
  priority?: number;
  activeFlag?: boolean;
  active: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
}

export interface ICoverageRuleModel extends Model<ICoverageRule> {
  list(criteria: any): Promise<ICoverageRule[]>;
  totalCount(criteria: any): Promise<number>;
}

const coverageRuleSchema = new Schema<ICoverageRule, ICoverageRuleModel>(
  {
    coverageRuleId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    payerId: { type: String, trim: true, index: true },
    planName: { type: String, trim: true, index: true },
    groupNumber: { type: String, trim: true, index: true },
    state: { type: String, trim: true, uppercase: true, index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', index: true },
    cptCode: { type: String, trim: true, uppercase: true, index: true },
    diagnosisCodes: { type: [String], default: [] },
    placeOfServiceCode: { type: String, trim: true, index: true },
    network: { type: String, trim: true, index: true },
    coverageType: { type: String, trim: true, index: true },
    ruleType: { type: String, required: true, trim: true, uppercase: true, index: true },
    severity: { type: String, trim: true, uppercase: true, enum: COVERAGE_RULE_SEVERITIES, default: 'WARNING', index: true },
    ruleValue: { type: Schema.Types.Mixed },
    effectiveDate: { type: Date },
    expiryDate: { type: Date },
    priority: { type: Number, default: 0, index: true },
    activeFlag: { type: Boolean, default: true },
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

coverageRuleSchema.index({
  payerId: 1,
  cptCode: 1,
  providerId: 1,
  facilityId: 1,
  state: 1,
  placeOfServiceCode: 1,
  planName: 1,
  groupNumber: 1,
  network: 1,
  coverageType: 1,
  priority: -1,
  effectiveDate: -1,
});

coverageRuleSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

coverageRuleSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const CoverageRule = model<ICoverageRule, ICoverageRuleModel>('CoverageRule', coverageRuleSchema);
