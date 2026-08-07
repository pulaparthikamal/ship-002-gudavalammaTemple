import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';
import { CHARGE_CODING_REVIEW_STATUS_OPTIONS, CHARGE_STATUS_OPTIONS } from './charge.constants';
import { IStatusHistoryEntry, statusHistorySchema } from '../workflow/workflow-history';

export interface IChargeChargeLine {
  _id?: ObjectIdType;
  lineNumber?: number;
  cptCode?: string;
  icdCodes?: string[];
  icdPointers?: number[];
  modifiers?: string[];
  units?: number;
  chargeAmount?: number;
  diagnosisLinking?: string;
  renderingProviderId?: ObjectIdType;
  expectedAllowedAmount?: number;
  feeScheduleId?: ObjectIdType;
  pricingStatus?: string;
  pricingMessage?: string;
}

export interface ICharge extends BaseDocument {
  chargeId: ObjectIdType;
  encounterId?: ObjectIdType;
  patientId?: ObjectIdType;
  providerId?: ObjectIdType;
  facilityId?: ObjectIdType;
  serviceDate?: Date;
  placeOfService?: string;
  totalChargeAmount?: number;
  chargeStatus?: string;
  codingReviewStatus?: string;
  documentationComplete?: boolean;
  validationErrors?: string[];
  createdBy?: string;
  reviewedBy?: string;
  chargeLines: IChargeChargeLine[];
  statusHistory?: IStatusHistoryEntry[];
  active: boolean;
  created: Date;
  updated: Date;
  createdByUserId?: ObjectIdType;
  updatedByUserId?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IChargeModel extends Model<ICharge> {
  list(criteria: any): Promise<ICharge[]>;
  totalCount(criteria: any): Promise<number>;
}

const chargeLinesSchema = new Schema<IChargeChargeLine>(
  {
    lineNumber: { type: Number },
    cptCode: { type: String, trim: true },
    icdCodes: { type: [String], default: [] },
    icdPointers: { type: [Number], default: [] },
    modifiers: { type: [String], default: [] },
    units: { type: Number },
    chargeAmount: { type: Number },
    diagnosisLinking: { type: String, trim: true },
    renderingProviderId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    expectedAllowedAmount: { type: Number },
    feeScheduleId: { type: Schema.Types.ObjectId, ref: 'FeeSchedule' },
    pricingStatus: { type: String, trim: true },
    pricingMessage: { type: String, trim: true },
  }
);

const chargeSchema = new Schema<ICharge, IChargeModel>(
  {
    chargeId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility' },
    serviceDate: { type: Date },
    placeOfService: { type: String, trim: true },
    totalChargeAmount: { type: Number },
    chargeStatus: { type: String, trim: true, enum: CHARGE_STATUS_OPTIONS, default: 'Draft' },
    codingReviewStatus: {
      type: String,
      trim: true,
      enum: CHARGE_CODING_REVIEW_STATUS_OPTIONS,
      default: 'Not Started',
    },
    documentationComplete: { type: Boolean, default: false },
    validationErrors: { type: [String], default: [] },
    createdBy: { type: String, trim: true },
    reviewedBy: { type: String, trim: true },
    chargeLines: { type: [chargeLinesSchema], default: [] },
    statusHistory: { type: [statusHistorySchema], default: [] },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

chargeSchema.virtual('createdAt').get(function () {
  return this.created;
});

chargeSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

chargeSchema.index({ isDeleted: 1, updated: -1 });
chargeSchema.index({ serviceDate: 1 });
chargeSchema.index({ chargeStatus: 1 });
chargeSchema.index({ encounterId: 1 });

chargeSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

chargeSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Charge = model<ICharge, IChargeModel>('Charge', chargeSchema);
