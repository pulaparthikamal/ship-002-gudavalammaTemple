import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareRootCauseAnalysis extends BaseDocument {
  analysisId: string;
  equipmentId: string;
  equipmentName: string;
  failureType: string;
  component?: string;
  problem: string;
  likelyRootCauses: string[];
  evidence: string[];
  recommendedActions: string[];
  causeConfidence?: Array<{ cause: string; confidence: number }>;
  preventiveControls?: string[];
  evidenceSummary?: string;
  confidence: number;
  aiProvider: string;
  status: 'Draft' | 'Reviewed' | 'Accepted';
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareRootCauseAnalysisModel extends Model<IMineCareRootCauseAnalysis> {
  list(criteria: any): Promise<IMineCareRootCauseAnalysis[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareRootCauseAnalysisSchema = new Schema<IMineCareRootCauseAnalysis, IMineCareRootCauseAnalysisModel>(
  {
    analysisId: { type: String, required: true, unique: true, index: true, trim: true },
    equipmentId: { type: String, required: true, index: true, trim: true },
    equipmentName: { type: String, trim: true },
    failureType: { type: String, required: true, trim: true },
    component: { type: String, trim: true },
    problem: { type: String, trim: true },
    likelyRootCauses: { type: [String], default: [] },
    evidence: { type: [String], default: [] },
    recommendedActions: { type: [String], default: [] },
    causeConfidence: { type: [{ cause: String, confidence: Number }], default: [] },
    preventiveControls: { type: [String], default: [] },
    evidenceSummary: { type: String, trim: true },
    confidence: { type: Number, default: 0 },
    aiProvider: { type: String, default: 'deterministic-fallback', trim: true },
    status: { type: String, enum: ['Draft', 'Reviewed', 'Accepted'], default: 'Draft' },
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
mineCareRootCauseAnalysisSchema.virtual('createdAt').get(function () { return this.created; });
mineCareRootCauseAnalysisSchema.virtual('updatedAt').get(function () { return this.updated; });
mineCareRootCauseAnalysisSchema.index({ isDeleted: 1, updated: -1 });
mineCareRootCauseAnalysisSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareRootCauseAnalysisSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };

export const MineCareRootCauseAnalysis = model<IMineCareRootCauseAnalysis, IMineCareRootCauseAnalysisModel>('MineCareRootCauseAnalysis', mineCareRootCauseAnalysisSchema);
