import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IArWorkItemFollowUpHistory {
  followUpDate?: Date;
  followUpType?: string;
  notes?: string;
  performedBy?: string;
}

export interface IArWorkItemContactHistory {
  contactDate?: Date;
  contactType?: string;
  contactName?: string;
  outcome?: string;
  notes?: string;
  performedBy?: string;
}

export interface IArWorkItem extends BaseDocument {
  arWorkItemId: ObjectIdType;
  claimId?: ObjectIdType;
  claimLineId?: ObjectIdType;
  denialId?: ObjectIdType;
  appealId?: ObjectIdType;
  correctedClaimId?: ObjectIdType;
  paymentPostingId?: ObjectIdType;
  patientId?: ObjectIdType;
  payerId?: string;
  category?: string;
  balanceAmount?: number;
  expectedAmount?: number;
  paidAmount?: number;
  varianceAmount?: number;
  agingBucket?: string;
  denialCode?: string;
  denialCategory?: string;
  priority?: string;
  status?: string;
  owner?: string;
  followUpDate?: Date;
  dueDate?: Date;
  reason?: string;
  nextAction?: string;
  notes?: string;
  dedupeKey?: string;
  sourceType?: string;
  sourceId?: ObjectIdType;
  assignedTo?: string;
  team?: string;
  rootCauseAnalysis?: string;
  suggestedFix?: string;
  aiPriorityAnalysis?: Record<string, unknown>;
  aiRecommendationHistory?: Array<Record<string, unknown>>;
  nextFollowUpDate?: Date;
  appealRequired?: boolean;
  correctedClaimRequired?: boolean;
  escalationFlag?: boolean;
  followUpHistory: IArWorkItemFollowUpHistory[];
  contactHistory: IArWorkItemContactHistory[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IArWorkItemModel extends Model<IArWorkItem> {
  list(criteria: any): Promise<IArWorkItem[]>;
  totalCount(criteria: any): Promise<number>;
}

const followUpHistorySchema = new Schema<IArWorkItemFollowUpHistory>(
  {
    followUpDate: { type: Date },
    followUpType: { type: String, trim: true },
    notes: { type: String, trim: true },
    performedBy: { type: String, trim: true },
  },
  { _id: false }
);

const contactHistorySchema = new Schema<IArWorkItemContactHistory>(
  {
    contactDate: { type: Date },
    contactType: { type: String, trim: true },
    contactName: { type: String, trim: true },
    outcome: { type: String, trim: true },
    notes: { type: String, trim: true },
    performedBy: { type: String, trim: true },
  },
  { _id: false }
);

const arWorkItemSchema = new Schema<IArWorkItem, IArWorkItemModel>(
  {
    arWorkItemId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    claimLineId: { type: Schema.Types.ObjectId },
    denialId: { type: Schema.Types.ObjectId, ref: 'Denial' },
    appealId: { type: Schema.Types.ObjectId, ref: 'Appeal' },
    correctedClaimId: { type: Schema.Types.ObjectId, ref: 'CorrectedClaim' },
    paymentPostingId: { type: Schema.Types.ObjectId, ref: 'PaymentPosting' },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    payerId: { type: String, trim: true },
    category: { type: String, trim: true },
    balanceAmount: { type: Number },
    expectedAmount: { type: Number },
    paidAmount: { type: Number },
    varianceAmount: { type: Number },
    agingBucket: { type: String, trim: true },
    denialCode: { type: String, trim: true },
    denialCategory: { type: String, trim: true },
    priority: { type: String, trim: true },
    status: { type: String, trim: true },
    owner: { type: String, trim: true },
    followUpDate: { type: Date },
    dueDate: { type: Date },
    reason: { type: String, trim: true },
    nextAction: { type: String, trim: true },
    notes: { type: String, trim: true },
    dedupeKey: { type: String, trim: true },
    sourceType: { type: String, trim: true },
    sourceId: { type: Schema.Types.ObjectId },
    assignedTo: { type: String, trim: true },
    team: { type: String, trim: true },
    rootCauseAnalysis: { type: String, trim: true },
    suggestedFix: { type: String, trim: true },
    aiPriorityAnalysis: { type: Schema.Types.Mixed },
    aiRecommendationHistory: { type: [Schema.Types.Mixed], default: [] },
    nextFollowUpDate: { type: Date },
    appealRequired: { type: Boolean, default: false },
    correctedClaimRequired: { type: Boolean, default: false },
    escalationFlag: { type: Boolean, default: false },
    followUpHistory: { type: [followUpHistorySchema], default: [] },
    contactHistory: { type: [contactHistorySchema], default: [] },
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

arWorkItemSchema.virtual('createdAt').get(function () {
  return this.created;
});

arWorkItemSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

arWorkItemSchema.index({ isDeleted: 1, updated: -1 });
arWorkItemSchema.index({ agingBucket: 1 });
arWorkItemSchema.index({ status: 1 });
arWorkItemSchema.index({ denialId: 1 });
arWorkItemSchema.index({ category: 1, status: 1 });
arWorkItemSchema.index({ dueDate: 1, priority: 1 });
arWorkItemSchema.index({ sourceType: 1, sourceId: 1 });
arWorkItemSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

arWorkItemSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

arWorkItemSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ArWorkItem = model<IArWorkItem, IArWorkItemModel>('ArWorkItem', arWorkItemSchema);
