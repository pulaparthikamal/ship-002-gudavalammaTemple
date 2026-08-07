import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';
import { ENCOUNTER_VISIT_STATUS_OPTIONS } from './encounter.constants';
import { IStatusHistoryEntry, statusHistorySchema } from '../workflow/workflow-history';

export interface IEncounterVital {
  temperature?: number;
  bloodPressure?: string;
  pulse?: number;
  height?: number;
  weight?: number;
  bmi?: number;
}

export interface IEncounterCheckout {
  checkOutTime?: Date;
  followUpRequired?: boolean;
  balanceDue?: number;
  followUpInstructions?: string;
}

export interface IEncounter extends BaseDocument {
  encounterId: ObjectIdType;
  appointmentId?: ObjectIdType;
  patientId?: ObjectIdType;
  providerId?: ObjectIdType;
  renderingProviderId?: ObjectIdType;
  supervisingProviderId?: ObjectIdType;
  facilityId?: ObjectIdType;
  encounterDate?: Date;
  startTime?: Date;
  endTime?: Date;
  visitStatus?: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  clinicalNotes?: string;
  diagnosisCodes?: string[];
  procedureCodes?: string[];
  procedureCodeUnits?: Record<string, number>;
  insurancePolicySnapshot?: {
    insurancePolicyId?: ObjectIdType;
    payerId?: string;
    ediPayerId?: string;
    memberId?: string;
    planName?: string;
    groupNumber?: string;
    network?: string;
    coverageType?: string;
    coveragePriority?: string;
    snapshottedAt?: Date;
  };
  vitals?: IEncounterVital;
  checkout?: IEncounterCheckout;
  statusHistory?: IStatusHistoryEntry[];
  estimate?: {
    estimatedPatientResponsibility?: number;
    estimatedInsurancePayment?: number;
    estimatedAllowedAmount?: number;
    lastEstimatedAt?: Date;
  };
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IEncounterModel extends Model<IEncounter> {
  list(criteria: any): Promise<IEncounter[]>;
  totalCount(criteria: any): Promise<number>;
}

const vitalsSchema = new Schema<IEncounterVital>(
  {
    temperature: { type: Number },
    bloodPressure: { type: String, trim: true },
    pulse: { type: Number },
    height: { type: Number },
    weight: { type: Number },
    bmi: { type: Number },
  },
  { _id: false }
);

const checkoutSchema = new Schema<IEncounterCheckout>(
  {
    checkOutTime: { type: Date },
    followUpRequired: { type: Boolean, default: false },
    balanceDue: { type: Number },
    followUpInstructions: { type: String, trim: true },
  },
  { _id: false }
);

const encounterSchema = new Schema<IEncounter, IEncounterModel>(
  {
    encounterId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    renderingProviderId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    supervisingProviderId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility' },
    encounterDate: { type: Date },
    startTime: { type: Date },
    endTime: { type: Date },
    visitStatus: { type: String, trim: true, enum: ENCOUNTER_VISIT_STATUS_OPTIONS, default: 'Created' },
    chiefComplaint: { type: String, trim: true },
    historyOfPresentIllness: { type: String, trim: true },
    clinicalNotes: { type: String, trim: true },
    diagnosisCodes: { type: [String], default: [] },
    procedureCodes: { type: [String], default: [] },
    procedureCodeUnits: { type: Map, of: Number, default: {} },
    insurancePolicySnapshot: {
      insurancePolicyId: { type: Schema.Types.ObjectId, ref: 'InsurancePolicy' },
      payerId: { type: String, trim: true },
      ediPayerId: { type: String, trim: true },
      memberId: { type: String, trim: true },
      planName: { type: String, trim: true },
      groupNumber: { type: String, trim: true },
      network: { type: String, trim: true },
      coverageType: { type: String, trim: true },
      coveragePriority: { type: String, trim: true },
      snapshottedAt: { type: Date },
    },
    vitals: { type: vitalsSchema, default: {} },
    checkout: { type: checkoutSchema, default: {} },
    statusHistory: { type: [statusHistorySchema], default: [] },
    estimate: {
      estimatedPatientResponsibility: { type: Number },
      estimatedInsurancePayment: { type: Number },
      estimatedAllowedAmount: { type: Number },
      lastEstimatedAt: { type: Date },
    },
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

encounterSchema.virtual('createdAt').get(function () {
  return this.created;
});

encounterSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

encounterSchema.index({ isDeleted: 1, updated: -1 });
encounterSchema.index({ encounterDate: 1 });
encounterSchema.index({ visitStatus: 1 });
encounterSchema.index({ appointmentId: 1 }, { unique: false });
encounterSchema.index({ patientId: 1, encounterDate: 1 });

encounterSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

encounterSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Encounter = model<IEncounter, IEncounterModel>('Encounter', encounterSchema);
