import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IAppealPayerRule extends BaseDocument {
  appealPayerRuleId: ObjectIdType;
  payerId: string;
  payerName?: string;
  effectiveDate?: Date;
  expirationDate?: Date;
  requiredEvidence: string[];
  requiredForms: string[];
  allowedSubmissionChannels: string[];
  deadlineDays: number;
  appealLevels: string[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType | string;
  updatedBy?: ObjectIdType | string;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IAppealPayerRuleModel extends Model<IAppealPayerRule> {
  list(criteria: any): Promise<IAppealPayerRule[]>;
  totalCount(criteria: any): Promise<number>;
}

const appealPayerRuleSchema = new Schema<IAppealPayerRule, IAppealPayerRuleModel>(
  {
    appealPayerRuleId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    payerId: { type: String, required: true, trim: true, index: true },
    payerName: { type: String, trim: true },
    effectiveDate: { type: Date, index: true },
    expirationDate: { type: Date, index: true },
    requiredEvidence: { type: [String], default: [] },
    requiredForms: { type: [String], default: [] },
    allowedSubmissionChannels: { type: [String], default: ['PORTAL', 'FAX', 'MAIL', 'MANUAL'] },
    deadlineDays: { type: Number, default: 60 },
    appealLevels: { type: [String], default: ['LEVEL_1'] },
    active: { type: Boolean, default: true, index: true },
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

appealPayerRuleSchema.virtual('createdAt').get(function () {
  return this.created;
});

appealPayerRuleSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

appealPayerRuleSchema.index({ payerId: 1, active: 1, effectiveDate: -1 });
appealPayerRuleSchema.index({ isDeleted: 1, updated: -1 });

appealPayerRuleSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

appealPayerRuleSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const AppealPayerRule = model<IAppealPayerRule, IAppealPayerRuleModel>('AppealPayerRule', appealPayerRuleSchema);
