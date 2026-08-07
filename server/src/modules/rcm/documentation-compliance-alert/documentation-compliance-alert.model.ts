import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export type DocumentationComplianceStatus = 'PASS' | 'FAIL';
export type DocumentationComplianceSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface IDocumentationComplianceAlert extends BaseDocument {
  alertId: ObjectIdType;
  alertType: 'DOCUMENTATION_GAP';
  claimId: ObjectIdType;
  missingDocuments: string[];
  requiredDocuments: string[];
  matchedDocuments?: string[];
  severity: DocumentationComplianceSeverity;
  status: DocumentationComplianceStatus;
  lastZapierTriggeredAt?: Date;
  lastZapierStatus?: DocumentationComplianceStatus;
  lastZapierMissingDocuments?: string[];
  zapierDeliveryStatus?: string;
  zapierDeliveryError?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IDocumentationComplianceAlertModel extends Model<IDocumentationComplianceAlert> {
  list(criteria: any): Promise<IDocumentationComplianceAlert[]>;
  totalCount(criteria: any): Promise<number>;
}

const documentationComplianceAlertSchema = new Schema<IDocumentationComplianceAlert, IDocumentationComplianceAlertModel>(
  {
    alertId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    alertType: { type: String, trim: true, enum: ['DOCUMENTATION_GAP'], default: 'DOCUMENTATION_GAP', index: true },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim', required: true },
    missingDocuments: { type: [String], default: [] },
    requiredDocuments: { type: [String], default: [] },
    matchedDocuments: { type: [String], default: [] },
    severity: { type: String, trim: true, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true, index: true },
    status: { type: String, trim: true, enum: ['PASS', 'FAIL'], required: true, index: true },
    lastZapierTriggeredAt: { type: Date },
    lastZapierStatus: { type: String, trim: true, enum: ['PASS', 'FAIL'] },
    lastZapierMissingDocuments: { type: [String], default: [] },
    zapierDeliveryStatus: { type: String, trim: true },
    zapierDeliveryError: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
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

documentationComplianceAlertSchema.virtual('createdAt').get(function () {
  return this.created;
});

documentationComplianceAlertSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

documentationComplianceAlertSchema.index({ claimId: 1 }, { unique: true });
documentationComplianceAlertSchema.index({ isDeleted: 1, active: 1, status: 1, severity: 1 });
documentationComplianceAlertSchema.index({ isDeleted: 1, updated: -1 });

documentationComplianceAlertSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

documentationComplianceAlertSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const DocumentationComplianceAlert = model<IDocumentationComplianceAlert, IDocumentationComplianceAlertModel>(
  'DocumentationComplianceAlert',
  documentationComplianceAlertSchema
);
