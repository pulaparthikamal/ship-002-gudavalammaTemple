import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export type MineCareRecommendationPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type MineCareRecommendationStatus = 'Open' | 'In Progress' | 'Completed' | 'Dismissed';
export type MineCareRecommendationSource = 'Service' | 'Warranty' | 'Risk' | 'Spare' | 'Root Cause' | 'Checklist' | 'Budget' | 'AI' | 'Vendor' | 'Procurement';

export interface IMineCareRecommendation extends BaseDocument {
  recommendationId: string;
  equipmentId?: string;
  equipmentName?: string;
  recommendationType: string;
  title: string;
  reason: string;
  priority: MineCareRecommendationPriority;
  recommendedAction: string;
  estimatedImpact: string;
  estimatedSavings: number;
  source: MineCareRecommendationSource;
  confidence: number;
  status: MineCareRecommendationStatus;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareRecommendationModel extends Model<IMineCareRecommendation> {
  list(criteria: any): Promise<IMineCareRecommendation[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareRecommendationSchema = new Schema<IMineCareRecommendation, IMineCareRecommendationModel>(
  {
    recommendationId: { type: String, required: true, unique: true, index: true, trim: true },
    equipmentId: { type: String, index: true, trim: true },
    equipmentName: { type: String, trim: true },
    recommendationType: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium', index: true },
    recommendedAction: { type: String, required: true, trim: true },
    estimatedImpact: { type: String, trim: true },
    estimatedSavings: { type: Number, default: 0 },
    source: { type: String, enum: ['Service', 'Warranty', 'Risk', 'Spare', 'Root Cause', 'Checklist', 'Budget', 'AI', 'Vendor', 'Procurement'], default: 'AI', index: true },
    confidence: { type: Number, default: 0 },
    status: { type: String, enum: ['Open', 'In Progress', 'Completed', 'Dismissed'], default: 'Open', index: true },
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

mineCareRecommendationSchema.virtual('createdAt').get(function () { return this.created; });
mineCareRecommendationSchema.virtual('updatedAt').get(function () { return this.updated; });
mineCareRecommendationSchema.index({ isDeleted: 1, status: 1, priority: 1, updated: -1 });
mineCareRecommendationSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareRecommendationSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };

export const MineCareRecommendation = model<IMineCareRecommendation, IMineCareRecommendationModel>('MineCareRecommendation', mineCareRecommendationSchema);
