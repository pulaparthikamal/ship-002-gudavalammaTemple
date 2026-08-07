import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareChecklistItem {
  itemId: string;
  step: number;
  task: string;
  safetyNote?: string;
  requiredPart?: string;
  estimatedTimeMinutes?: number;
  completed: boolean;
}

export interface IMineCareChecklist extends BaseDocument {
  checklistId: string;
  equipmentId: string;
  equipmentName: string;
  serviceType: string;
  checklistTitle: string;
  items: IMineCareChecklistItem[];
  safetyPrecautions: string[];
  requiredTools: string[];
  requiredParts: string[];
  skillRequirement?: string;
  qualityGate?: string;
  aiPreparationNotes?: string[];
  confidence: number;
  status: 'Draft' | 'Active' | 'Completed';
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareChecklistModel extends Model<IMineCareChecklist> {
  list(criteria: any): Promise<IMineCareChecklist[]>;
  totalCount(criteria: any): Promise<number>;
}

const checklistItemSchema = new Schema<IMineCareChecklistItem>({
  itemId: { type: String, required: true, trim: true },
  step: { type: Number, required: true },
  task: { type: String, required: true, trim: true },
  safetyNote: { type: String, trim: true },
  requiredPart: { type: String, trim: true },
  estimatedTimeMinutes: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
}, { _id: false });

const mineCareChecklistSchema = new Schema<IMineCareChecklist, IMineCareChecklistModel>(
  {
    checklistId: { type: String, required: true, unique: true, index: true, trim: true },
    equipmentId: { type: String, required: true, index: true, trim: true },
    equipmentName: { type: String, trim: true },
    serviceType: { type: String, required: true, trim: true },
    checklistTitle: { type: String, required: true, trim: true },
    items: { type: [checklistItemSchema], default: [] },
    safetyPrecautions: { type: [String], default: [] },
    requiredTools: { type: [String], default: [] },
    requiredParts: { type: [String], default: [] },
    skillRequirement: { type: String, trim: true },
    qualityGate: { type: String, trim: true },
    aiPreparationNotes: { type: [String], default: [] },
    confidence: { type: Number, default: 0 },
    status: { type: String, enum: ['Draft', 'Active', 'Completed'], default: 'Draft' },
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
mineCareChecklistSchema.virtual('createdAt').get(function () { return this.created; });
mineCareChecklistSchema.virtual('updatedAt').get(function () { return this.updated; });
mineCareChecklistSchema.index({ isDeleted: 1, updated: -1 });
mineCareChecklistSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareChecklistSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };

export const MineCareChecklist = model<IMineCareChecklist, IMineCareChecklistModel>('MineCareChecklist', mineCareChecklistSchema);
