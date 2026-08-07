import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IPriorAuthorization extends BaseDocument {
  authorizationId: ObjectIdType;
  patientId?: ObjectIdType;
  insuranceId?: ObjectIdType;
  payerId?: string;
  providerId?: ObjectIdType;
  facilityId?: ObjectIdType;
  serviceDate?: Date;
  placeOfService?: string;
  procedureCodes?: string[];
  diagnosisCodes?: string[];
  modifiers?: string[];
  authorizationRequired?: boolean;
  authorizationType?: string;
  requestDate?: Date;
  requestedUnits?: number;
  approvedUnits?: number;
  authNumber?: string;
  authorizationStatus?: string;
  expirationDate?: Date;
  denialReason?: string;
  notes?: string;
  automationStatus?: string;
  payerPortalReference?: string;
  authPacket?: Record<string, unknown>;
  documentChecklist?: Array<Record<string, unknown>>;
  statusCheckHistory?: Array<Record<string, unknown>>;
  statusHistory?: string[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IPriorAuthorizationModel extends Model<IPriorAuthorization> {
  list(criteria: any): Promise<IPriorAuthorization[]>;
  totalCount(criteria: any): Promise<number>;
}

const priorAuthorizationSchema = new Schema<IPriorAuthorization, IPriorAuthorizationModel>(
  {
    authorizationId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    insuranceId: { type: Schema.Types.ObjectId, ref: 'InsurancePolicy' },
    payerId: { type: String, trim: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility' },
    serviceDate: { type: Date },
    placeOfService: { type: String, trim: true },
    procedureCodes: { type: [String], default: [] },
    diagnosisCodes: { type: [String], default: [] },
    modifiers: { type: [String], default: [] },
    authorizationRequired: { type: Boolean, default: false },
    authorizationType: { type: String, trim: true },
    requestDate: { type: Date },
    requestedUnits: { type: Number },
    approvedUnits: { type: Number },
    authNumber: { type: String, trim: true },
    authorizationStatus: { type: String, trim: true },
    expirationDate: { type: Date },
    denialReason: { type: String, trim: true },
    notes: { type: String, trim: true },
    automationStatus: { type: String, trim: true },
    payerPortalReference: { type: String, trim: true },
    authPacket: { type: Schema.Types.Mixed, default: {} },
    documentChecklist: { type: [Schema.Types.Mixed], default: [] },
    statusCheckHistory: { type: [Schema.Types.Mixed], default: [] },
    statusHistory: { type: [String], default: [] },
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

priorAuthorizationSchema.virtual('createdAt').get(function () {
  return this.created;
});

priorAuthorizationSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

priorAuthorizationSchema.index({ isDeleted: 1, updated: -1 });
priorAuthorizationSchema.index({ authNumber: 1 });
priorAuthorizationSchema.index({ authorizationStatus: 1 });

priorAuthorizationSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

priorAuthorizationSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const PriorAuthorization = model<IPriorAuthorization, IPriorAuthorizationModel>('PriorAuthorization', priorAuthorizationSchema);
