import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface ICollection extends BaseDocument {
  collectionId: ObjectIdType;
  patientId?: ObjectIdType;
  patientBillingId?: ObjectIdType;
  claimId?: ObjectIdType;
  originalBalance?: number;
  currentBalance?: number;
  daysPastDue?: number;
  collectionStage?: string;
  status?: string;
  owner?: string;
  lastContactDate?: Date;
  nextContactDate?: Date;
  contactAttempts?: number;
  resolution?: string;
  writeOffAmount?: number;
  settlementAmount?: number;
  actionAudit?: Array<Record<string, unknown>>;
  dedupeKey?: string;
  balanceAmount?: number;
  agencyName?: string;
  referredDate?: Date;
  collectionStatus?: string;
  recoveredAmount?: number;
  closeDate?: Date;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface ICollectionModel extends Model<ICollection> {
  list(criteria: any): Promise<ICollection[]>;
  totalCount(criteria: any): Promise<number>;
}

const collectionSchema = new Schema<ICollection, ICollectionModel>(
  {
    collectionId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    patientBillingId: { type: Schema.Types.ObjectId, ref: 'PatientBilling' },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    originalBalance: { type: Number },
    currentBalance: { type: Number },
    daysPastDue: { type: Number },
    collectionStage: { type: String, trim: true },
    status: { type: String, trim: true },
    owner: { type: String, trim: true },
    lastContactDate: { type: Date },
    nextContactDate: { type: Date },
    contactAttempts: { type: Number, default: 0 },
    resolution: { type: String, trim: true },
    writeOffAmount: { type: Number },
    settlementAmount: { type: Number },
    actionAudit: { type: [Schema.Types.Mixed], default: [] },
    dedupeKey: { type: String, trim: true },
    balanceAmount: { type: Number },
    agencyName: { type: String, trim: true },
    referredDate: { type: Date },
    collectionStatus: { type: String, trim: true },
    recoveredAmount: { type: Number },
    closeDate: { type: Date },
    notes: { type: String, trim: true },
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

collectionSchema.virtual('createdAt').get(function () {
  return this.created;
});

collectionSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

collectionSchema.index({ isDeleted: 1, updated: -1 });
collectionSchema.index({ agencyName: 1 });
collectionSchema.index({ collectionStatus: 1 });
collectionSchema.index({ status: 1, collectionStage: 1 });
collectionSchema.index({ nextContactDate: 1 });
collectionSchema.index({ patientBillingId: 1 }, { sparse: true });
collectionSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

collectionSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

collectionSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Collection = model<ICollection, ICollectionModel>('Collection', collectionSchema);
