import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IDocument extends BaseDocument {
  documentId: ObjectIdType;
  patientId?: ObjectIdType;
  encounterId?: ObjectIdType;
  claimId?: ObjectIdType;
  denialId?: ObjectIdType;
  appealId?: ObjectIdType;
  eraId?: ObjectIdType;
  paymentPostingId?: ObjectIdType;
  entityType?: string;
  entityId?: ObjectIdType;
  documentCategory?: string;
  uploadSource?: string;
  documentType?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileUrl?: string;
  mimeType?: string;
  uploadedBy?: string;
  uploadedAt?: Date;
  tags?: string[];
  description?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IDocumentModel extends Model<IDocument> {
  list(criteria: any): Promise<IDocument[]>;
  totalCount(criteria: any): Promise<number>;
}

const documentSchema = new Schema<IDocument, IDocumentModel>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    denialId: { type: Schema.Types.ObjectId, ref: 'Denial' },
    appealId: { type: Schema.Types.ObjectId, ref: 'Appeal' },
    eraId: { type: Schema.Types.ObjectId, ref: 'EraEobProcessing' },
    paymentPostingId: { type: Schema.Types.ObjectId, ref: 'PaymentPosting' },
    entityType: { type: String, trim: true },
    entityId: { type: Schema.Types.ObjectId },
    documentCategory: { type: String, trim: true },
    uploadSource: { type: String, trim: true },
    documentType: { type: String, trim: true },
    fileName: { type: String, trim: true },
    fileType: { type: String, trim: true },
    fileSize: { type: Number, min: 0 },
    fileUrl: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    uploadedBy: { type: String, trim: true },
    uploadedAt: { type: Date },
    tags: { type: [String], default: [] },
    description: { type: String, trim: true },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

documentSchema.virtual('createdAt').get(function () {
  return this.created;
});

documentSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

documentSchema.index({ isDeleted: 1, updated: -1 });
documentSchema.index({ fileName: 1 });
documentSchema.index({ documentType: 1 });
documentSchema.index({ documentCategory: 1 });
documentSchema.index({ uploadSource: 1 });
documentSchema.index({ patientId: 1, uploadedAt: -1 });
documentSchema.index({ patientId: 1, encounterId: 1, uploadedAt: -1 });
documentSchema.index({ claimId: 1, uploadedAt: -1 });
documentSchema.index({ denialId: 1, uploadedAt: -1 });
documentSchema.index({ appealId: 1, uploadedAt: -1 });
documentSchema.index({ eraId: 1, uploadedAt: -1 });
documentSchema.index({ paymentPostingId: 1, uploadedAt: -1 });
documentSchema.index({ entityType: 1, entityId: 1, fileUrl: 1 });

documentSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

documentSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Document = model<IDocument, IDocumentModel>('Document', documentSchema);
