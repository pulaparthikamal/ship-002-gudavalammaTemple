import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';
import { FileCategory, fileCategories } from './scanResult.model';

export type DeletedFileTrigger = 'automation' | 'agent' | 'manual';

export interface IDeletedFile extends BaseDocument {
  server: Types.ObjectId;
  scanResult?: Types.ObjectId;
  scanId?: string;
  fileName: string;
  path: string;
  size: number;
  sizeMb: number;
  category: FileCategory;
  tags: FileCategory[];
  lastAccessed: Date;
  modifiedAt?: Date;
  reason: string;
  aiDecisionTrace: string[];
  command?: string;
  triggeredBy: DeletedFileTrigger;
  deletedAt: Date;
  created: Date;
}

const deletedFileSchema = new Schema<IDeletedFile>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    scanResult: { type: Schema.Types.ObjectId, ref: 'ScanResult', index: true },
    scanId: { type: String, index: true },
    fileName: { type: String, required: true },
    path: { type: String, required: true, index: true },
    size: { type: Number, required: true },
    sizeMb: { type: Number, required: true },
    category: {
      type: String,
      enum: fileCategories,
      required: true,
      index: true,
    },
    tags: { type: [String], enum: fileCategories, default: [] },
    lastAccessed: { type: Date, required: true },
    modifiedAt: { type: Date },
    reason: { type: String, required: true },
    aiDecisionTrace: { type: [String], default: [] },
    command: { type: String },
    triggeredBy: {
      type: String,
      enum: ['automation', 'agent', 'manual'],
      required: true,
      index: true,
    },
    deletedAt: { type: Date, default: Date.now, index: true },
    created: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'deletedFiles',
  },
);

deletedFileSchema.index({ server: 1, deletedAt: -1 });
deletedFileSchema.index({ server: 1, path: 1, deletedAt: -1 });

export const DeletedFile = model<IDeletedFile>('DeletedFile', deletedFileSchema);
