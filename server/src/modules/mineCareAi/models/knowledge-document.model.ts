import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareKnowledgeDocument extends BaseDocument {
  documentId: string;
  fileName: string;
  originalName: string;
  documentType: 'Manual' | 'SOP' | 'Warranty' | 'OEM Schedule' | 'Invoice' | 'Purchase Order' | 'Service Document' | 'Other';
  equipmentId?: string;
  equipmentType?: string;
  uploadSource?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: number;
  uploadedAt: Date;
  extractedTextPreview?: string;
  chunkCount: number;
  status: 'Processing' | 'Ready' | 'Failed';
  errorMessage?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareKnowledgeDocumentModel extends Model<IMineCareKnowledgeDocument> {
  list(criteria: any): Promise<IMineCareKnowledgeDocument[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareKnowledgeDocumentSchema = new Schema<IMineCareKnowledgeDocument, IMineCareKnowledgeDocumentModel>(
  {
    documentId: { type: String, required: true, unique: true, index: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true },
    documentType: { type: String, enum: ['Manual', 'SOP', 'Warranty', 'OEM Schedule', 'Invoice', 'Purchase Order', 'Service Document', 'Other'], default: 'Other' },
    equipmentId: { type: String, trim: true },
    equipmentType: { type: String, trim: true },
    uploadSource: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    fileSize: { type: Number, min: 0 },
    uploadedAt: { type: Date, default: Date.now },
    extractedTextPreview: { type: String },
    chunkCount: { type: Number, default: 0 },
    status: { type: String, enum: ['Processing', 'Ready', 'Failed'], default: 'Processing' },
    errorMessage: { type: String },
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
mineCareKnowledgeDocumentSchema.virtual('createdAt').get(function () { return this.created; });
mineCareKnowledgeDocumentSchema.virtual('updatedAt').get(function () { return this.updated; });
mineCareKnowledgeDocumentSchema.index({ isDeleted: 1, updated: -1 });
mineCareKnowledgeDocumentSchema.index({ equipmentId: 1, uploadedAt: -1 });
mineCareKnowledgeDocumentSchema.index({ uploadSource: 1, uploadedAt: -1 });
mineCareKnowledgeDocumentSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareKnowledgeDocumentSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };

export const MineCareKnowledgeDocument = model<IMineCareKnowledgeDocument, IMineCareKnowledgeDocumentModel>('MineCareKnowledgeDocument', mineCareKnowledgeDocumentSchema);
