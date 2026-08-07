import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareVendorSla extends BaseDocument {
  slaId: string;
  vendorName: string;
  contractType: string;
  equipmentIds: string[];
  serviceFrequencyDays: number;
  committedResponseHours: number;
  actualResponseHours: number;
  plannedServiceDate?: Date;
  actualServiceDate?: Date;
  missedServiceCount: number;
  slaCompliancePercent: number;
  penaltyAmount: number;
  status: 'Active' | 'At Risk' | 'Breached' | 'Closed';
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareVendorSlaModel extends Model<IMineCareVendorSla> {
  list(criteria: any): Promise<IMineCareVendorSla[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareVendorSlaSchema = new Schema<IMineCareVendorSla, IMineCareVendorSlaModel>(
  {
    slaId: { type: String, required: true, unique: true, index: true, trim: true },
    vendorName: { type: String, required: true, trim: true },
    contractType: { type: String, trim: true },
    equipmentIds: { type: [String], default: [] },
    serviceFrequencyDays: { type: Number, default: 30 },
    committedResponseHours: { type: Number, default: 24 },
    actualResponseHours: { type: Number, default: 0 },
    plannedServiceDate: { type: Date },
    actualServiceDate: { type: Date },
    missedServiceCount: { type: Number, default: 0 },
    slaCompliancePercent: { type: Number, default: 100 },
    penaltyAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'At Risk', 'Breached', 'Closed'], default: 'Active' },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
mineCareVendorSlaSchema.virtual('createdAt').get(function () { return this.created; });
mineCareVendorSlaSchema.virtual('updatedAt').get(function () { return this.updated; });
mineCareVendorSlaSchema.index({ isDeleted: 1, updated: -1 });
mineCareVendorSlaSchema.index({ vendorName: 1, isDeleted: 1 });
mineCareVendorSlaSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareVendorSlaSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };

export const MineCareVendorSla = model<IMineCareVendorSla, IMineCareVendorSlaModel>('MineCareVendorSla', mineCareVendorSlaSchema);
