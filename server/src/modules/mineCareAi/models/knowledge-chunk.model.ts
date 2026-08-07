import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareKnowledgeChunk extends BaseDocument {
  chunkId: string;
  documentId: string;
  documentName: string;
  section?: string;
  chunkIndex: number;
  text: string;
  keywords: string[];
  equipmentId?: string;
  equipmentType?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareKnowledgeChunkModel extends Model<IMineCareKnowledgeChunk> {
  list(criteria: any): Promise<IMineCareKnowledgeChunk[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareKnowledgeChunkSchema = new Schema<IMineCareKnowledgeChunk, IMineCareKnowledgeChunkModel>(
  {
    chunkId: { type: String, required: true, unique: true, index: true, trim: true },
    documentId: { type: String, required: true, index: true, trim: true },
    documentName: { type: String, trim: true },
    section: { type: String, trim: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    keywords: { type: [String], default: [] },
    equipmentId: { type: String, trim: true },
    equipmentType: { type: String, trim: true },
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
mineCareKnowledgeChunkSchema.index({ documentId: 1, isDeleted: 1 });
mineCareKnowledgeChunkSchema.index({ text: 'text', keywords: 'text' });
mineCareKnowledgeChunkSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareKnowledgeChunkSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };

export const MineCareKnowledgeChunk = model<IMineCareKnowledgeChunk, IMineCareKnowledgeChunkModel>('MineCareKnowledgeChunk', mineCareKnowledgeChunkSchema);
