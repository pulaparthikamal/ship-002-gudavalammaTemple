import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareTechnician extends BaseDocument {
  technicianId: string;
  technicianName: string;
  employeeId: string;
  skills: string[];
  equipmentTypes: string[];
  issueTypes: string[];
  availabilityStatus: 'Available' | 'Busy' | 'On Leave';
  averageResolutionHours: number;
  successRate: number;
  completedJobs: number;
  location: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareTechnicianModel extends Model<IMineCareTechnician> {
  list(criteria: any): Promise<IMineCareTechnician[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareTechnicianSchema = new Schema<IMineCareTechnician, IMineCareTechnicianModel>(
  {
    technicianId: { type: String, required: true, unique: true, index: true, trim: true },
    technicianName: { type: String, required: true, trim: true },
    employeeId: { type: String, required: true, trim: true },
    skills: { type: [String], default: [] },
    equipmentTypes: { type: [String], default: [] },
    issueTypes: { type: [String], default: [] },
    availabilityStatus: { type: String, enum: ['Available', 'Busy', 'On Leave'], default: 'Available' },
    averageResolutionHours: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    location: { type: String, trim: true },
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
mineCareTechnicianSchema.virtual('createdAt').get(function () { return this.created; });
mineCareTechnicianSchema.virtual('updatedAt').get(function () { return this.updated; });
mineCareTechnicianSchema.index({ isDeleted: 1, updated: -1 });
mineCareTechnicianSchema.index({ availabilityStatus: 1, isDeleted: 1 });
mineCareTechnicianSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareTechnicianSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };

export const MineCareTechnician = model<IMineCareTechnician, IMineCareTechnicianModel>('MineCareTechnician', mineCareTechnicianSchema);
