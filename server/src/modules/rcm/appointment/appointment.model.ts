import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';
import {
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
  CANONICAL_APPOINTMENT_TIME_REGEX,
  CANCELLATION_REASON_OPTIONS,
  CHECK_IN_STATUS_OPTIONS,
  VISIT_TYPE_OPTIONS,
} from './appointment.constants';
import { IStatusHistoryEntry, statusHistorySchema } from '../workflow/workflow-history';

export interface IAppointmentReferral {
  required?: boolean;
  referralNumber?: string;
  validFrom?: Date;
  validTo?: Date;
}

export interface IAppointmentEstimate {
  estimatedPatientResponsibility?: number;
  depositAmount?: number;
  depositCollected?: boolean;
}

export interface IAppointment extends BaseDocument {
  appointmentId: ObjectIdType;
  patientId?: ObjectIdType;
  providerId?: ObjectIdType;
  facilityId?: ObjectIdType;
  appointmentDate?: Date;
  appointmentTime?: string;
  appointmentStart?: Date;
  appointmentType?: string;
  visitType?: string;
  reason?: string;
  appointmentStatus?: string;
  checkInStatus?: string;
  checkInTime?: Date;
  checkOutTime?: Date;
  noShowFlag?: boolean;
  cancellationReason?: string;
  notes?: string;
  referral?: IAppointmentReferral;
  estimate?: IAppointmentEstimate;
  statusHistory?: IStatusHistoryEntry[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IAppointmentModel extends Model<IAppointment> {
  list(criteria: any): Promise<IAppointment[]>;
  totalCount(criteria: any): Promise<number>;
}

const referralSchema = new Schema<IAppointmentReferral>(
  {
    required: { type: Boolean, default: false },
    referralNumber: { type: String, trim: true },
    validFrom: { type: Date },
    validTo: { type: Date },
  },
  { _id: false }
);

const estimateSchema = new Schema<IAppointmentEstimate>(
  {
    estimatedPatientResponsibility: { type: Number },
    depositAmount: { type: Number },
    depositCollected: { type: Boolean, default: false },
  },
  { _id: false }
);

const appointmentSchema = new Schema<IAppointment, IAppointmentModel>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
    appointmentDate: { type: Date, required: true },
    appointmentTime: {
      type: String,
      trim: true,
      required: true,
      validate: {
        validator: (value: string) => CANONICAL_APPOINTMENT_TIME_REGEX.test(value),
        message: 'Appointment time must use HH:mm.',
      },
    },
    appointmentStart: { type: Date },
    appointmentType: { type: String, trim: true, enum: APPOINTMENT_TYPE_OPTIONS, required: true },
    visitType: { type: String, trim: true, enum: VISIT_TYPE_OPTIONS, required: true },
    reason: { type: String, trim: true, required: true },
    appointmentStatus: { type: String, trim: true, enum: APPOINTMENT_STATUS_OPTIONS, default: 'Scheduled' },
    checkInStatus: { type: String, trim: true, enum: CHECK_IN_STATUS_OPTIONS, default: 'Pending' },
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    noShowFlag: { type: Boolean, default: false },
    cancellationReason: { type: String, trim: true, enum: CANCELLATION_REASON_OPTIONS },
    notes: { type: String, trim: true },
    referral: { type: referralSchema, default: {} },
    estimate: { type: estimateSchema, default: {} },
    statusHistory: { type: [statusHistorySchema], default: [] },
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

appointmentSchema.virtual('createdAt').get(function () {
  return this.created;
});

appointmentSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

appointmentSchema.index({ isDeleted: 1, updated: -1 });
appointmentSchema.index({ appointmentDate: 1 });
appointmentSchema.index({ appointmentTime: 1 });
appointmentSchema.index({ appointmentStart: 1 });
appointmentSchema.index({ patientId: 1, appointmentDate: 1 });

appointmentSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

appointmentSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Appointment = model<IAppointment, IAppointmentModel>('Appointment', appointmentSchema);
