import mongoose, { Schema, model, Model } from 'mongoose';
import { AttachmentLink, BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IPatientAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface IPatientGuarantor {
  firstName?: string;
  lastName?: string;
  relationshipToPatient?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface IPatientEmergencyContact {
  firstName?: string;
  lastName?: string;
  relationship?: string;
  phone?: string;
  email?: string;
}

export interface IPatient extends BaseDocument {
  patientId: ObjectIdType;
  medicalRecordNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  dateOfBirth: Date;
  gender: string;
  sex?: string;
  maritalStatus?: string;
  mobileNumber?: string;
  alternatePhoneNumber?: string;
  email?: string;
  preferredLanguage?: string;
  interpreterRequired: boolean;
  race?: string;
  ethnicity?: string;
  patientStatus: string;
  ssnLast4?: string;
  employmentStatus?: string;
  employerName?: string;
  preferredCommunicationMethod?: string;
  deceased: boolean;
  dateOfDeath?: Date;
  consentToText: boolean;
  consentToCall: boolean;
  consentToEmail: boolean;
  hipaaConsentSigned: boolean;
  financialConsentSigned: boolean;
  address?: IPatientAddress;
  guarantor?: IPatientGuarantor;
  emergencyContacts: IPatientEmergencyContact[];
  attachments: AttachmentLink[];
  duplicateCheckFlag: boolean;
  mergeRequiredFlag: boolean;
  duplicateOfPatientId?: ObjectIdType;
  mergedIntoPatientId?: ObjectIdType;
  mergedAt?: Date;
  mergeNotes?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IPatientModel extends Model<IPatient> {
  list(criteria: any): Promise<IPatient[]>;
  totalCount(criteria: any): Promise<number>;
}

const addressSchema = new Schema<IPatientAddress>(
  {
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const guarantorSchema = new Schema<IPatientGuarantor>(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    relationshipToPatient: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
  },
  { _id: false }
);

const emergencyContactSchema = new Schema<IPatientEmergencyContact>(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    relationship: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const attachmentSchema = new Schema<AttachmentLink>(
  {
    documentType: { type: String, trim: true },
    title: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const patientSchema = new Schema<IPatient, IPatientModel>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    medicalRecordNumber: { type: String, required: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    suffix: { type: String, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, required: true, trim: true },
    sex: { type: String, trim: true },
    maritalStatus: { type: String, trim: true },
    mobileNumber: { type: String, trim: true },
    alternatePhoneNumber: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    preferredLanguage: { type: String, trim: true },
    interpreterRequired: { type: Boolean, default: false },
    race: { type: String, trim: true },
    ethnicity: { type: String, trim: true },
    patientStatus: { type: String, default: 'Active', trim: true },
    ssnLast4: { type: String, trim: true },
    employmentStatus: { type: String, trim: true },
    employerName: { type: String, trim: true },
    preferredCommunicationMethod: { type: String, trim: true },
    deceased: { type: Boolean, default: false },
    dateOfDeath: { type: Date },
    consentToText: { type: Boolean, default: false },
    consentToCall: { type: Boolean, default: false },
    consentToEmail: { type: Boolean, default: false },
    hipaaConsentSigned: { type: Boolean, default: false },
    financialConsentSigned: { type: Boolean, default: false },
    address: { type: addressSchema, default: {} },
    guarantor: { type: guarantorSchema, default: {} },
    emergencyContacts: { type: [emergencyContactSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    duplicateCheckFlag: { type: Boolean, default: false },
    mergeRequiredFlag: { type: Boolean, default: false },
    duplicateOfPatientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    mergedIntoPatientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    mergedAt: { type: Date },
    mergeNotes: { type: String, trim: true },
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

patientSchema.virtual('createdAt').get(function () {
  return this.created;
});

patientSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

patientSchema.index(
  { medicalRecordNumber: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
patientSchema.index({ firstName: 1, lastName: 1 });
patientSchema.index({ dateOfBirth: 1 });
patientSchema.index({ patientStatus: 1 });

patientSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

patientSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Patient = model<IPatient, IPatientModel>('Patient', patientSchema);

function isLegacyMrnIndex(index: { name?: unknown; key?: unknown }) {
  if (index.name === 'mrn_1') {
    return true;
  }

  if (typeof index.key !== 'object' || index.key === null) {
    return false;
  }

  const key = index.key as Record<string, unknown>;
  return Object.keys(key).length === 1 && key.mrn === 1;
}

export async function removeLegacyPatientIndexes() {
  try {
    const indexes = await Patient.collection.indexes();
    const legacyIndexNames = indexes
      .filter((index) => isLegacyMrnIndex(index))
      .map((index) => index.name)
      .filter((name): name is string => typeof name === 'string');

    for (const indexName of legacyIndexNames) {
      await Patient.collection.dropIndex(indexName);
      console.log(`Removed legacy patient index: ${indexName}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes('ns not found') ||
      message.includes('NamespaceNotFound') ||
      message.includes('index not found') ||
      message.includes('IndexNotFound')
    ) {
      return;
    }

    console.warn(`Unable to remove legacy patient indexes: ${message}`);
  }
}
