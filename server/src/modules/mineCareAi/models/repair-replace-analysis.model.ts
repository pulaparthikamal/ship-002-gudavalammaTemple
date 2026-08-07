import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareRepairReplaceAnalysis extends BaseDocument {
  analysisId: string;
  equipmentId: string;
  equipmentName: string;
  recommendation: string;
  reason: string;
  repairCostRatio: number;
  estimatedReplacementYear: number;
  financialImpact: {
    repairOptionCost: number;
    replacementOptionCost: number;
    downtimeRisk: number;
    projectedSavings: number;
  };
  recommendedActions: string[];
  decisionFactors?: string[];
  paybackEstimate?: string;
  confidence: number;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareRepairReplaceAnalysisModel extends Model<IMineCareRepairReplaceAnalysis> {
  list(criteria: any): Promise<IMineCareRepairReplaceAnalysis[]>;
  totalCount(criteria: any): Promise<number>;
}

const financialImpactSchema = new Schema({ repairOptionCost: Number, replacementOptionCost: Number, downtimeRisk: Number, projectedSavings: Number }, { _id: false });
const mineCareRepairReplaceAnalysisSchema = new Schema<IMineCareRepairReplaceAnalysis, IMineCareRepairReplaceAnalysisModel>(
  {
    analysisId: { type: String, required: true, unique: true, index: true, trim: true },
    equipmentId: { type: String, required: true, index: true, trim: true },
    equipmentName: { type: String, trim: true },
    recommendation: { type: String, trim: true },
    reason: { type: String, trim: true },
    repairCostRatio: { type: Number, default: 0 },
    estimatedReplacementYear: { type: Number, default: () => new Date().getFullYear() },
    financialImpact: { type: financialImpactSchema, default: {} },
    recommendedActions: { type: [String], default: [] },
    decisionFactors: { type: [String], default: [] },
    paybackEstimate: { type: String, trim: true },
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
mineCareRepairReplaceAnalysisSchema.index({ isDeleted: 1, updated: -1 });
mineCareRepairReplaceAnalysisSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareRepairReplaceAnalysisSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };
export const MineCareRepairReplaceAnalysis = model<IMineCareRepairReplaceAnalysis, IMineCareRepairReplaceAnalysisModel>('MineCareRepairReplaceAnalysis', mineCareRepairReplaceAnalysisSchema);
