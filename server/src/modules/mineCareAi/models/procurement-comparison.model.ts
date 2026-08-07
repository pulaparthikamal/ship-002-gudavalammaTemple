import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareProcurementComparison extends BaseDocument {
  comparisonId: string;
  selectedOptionIds: string[];
  bestOption: string;
  reason: string;
  comparison: Array<{ optionId: string; name: string; fiveYearTco: number }>;
  recommendedActions: string[];
  vendorRiskSummary?: string;
  negotiationPoints?: string[];
  decisionFactors?: string[];
  confidence: number;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareProcurementComparisonModel extends Model<IMineCareProcurementComparison> {
  list(criteria: any): Promise<IMineCareProcurementComparison[]>;
  totalCount(criteria: any): Promise<number>;
}

const comparisonItemSchema = new Schema({ optionId: String, name: String, fiveYearTco: Number }, { _id: false });
const mineCareProcurementComparisonSchema = new Schema<IMineCareProcurementComparison, IMineCareProcurementComparisonModel>(
  {
    comparisonId: { type: String, required: true, unique: true, index: true, trim: true },
    selectedOptionIds: { type: [String], default: [] },
    bestOption: { type: String, trim: true },
    reason: { type: String, trim: true },
    comparison: { type: [comparisonItemSchema], default: [] },
    recommendedActions: { type: [String], default: [] },
    vendorRiskSummary: { type: String, trim: true },
    negotiationPoints: { type: [String], default: [] },
    decisionFactors: { type: [String], default: [] },
    confidence: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
mineCareProcurementComparisonSchema.index({ isDeleted: 1, updated: -1 });
mineCareProcurementComparisonSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareProcurementComparisonSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };

export const MineCareProcurementComparison = model<IMineCareProcurementComparison, IMineCareProcurementComparisonModel>('MineCareProcurementComparison', mineCareProcurementComparisonSchema);
