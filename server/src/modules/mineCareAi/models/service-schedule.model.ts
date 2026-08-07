import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareServiceSchedule extends BaseDocument {
  serviceScheduleId: ObjectIdType;
  equipmentId?: string;
  equipmentType: string;
  serviceName: string;
  intervalHours: number;
  requiredParts: string[];
  estimatedCost: number;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareServiceScheduleModel extends Model<IMineCareServiceSchedule> {
  list(criteria: any): Promise<IMineCareServiceSchedule[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareServiceScheduleSchema = new Schema<IMineCareServiceSchedule, IMineCareServiceScheduleModel>(
  {
    serviceScheduleId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    equipmentId: { type: String, trim: true },
    equipmentType: { type: String, required: true, trim: true },
    serviceName: { type: String, required: true, trim: true },
    intervalHours: { type: Number, required: true },
    requiredParts: { type: [String], default: [] },
    estimatedCost: { type: Number, default: 0 },
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

mineCareServiceScheduleSchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareServiceScheduleSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareServiceScheduleSchema.index({ equipmentId: 1, isDeleted: 1 });
mineCareServiceScheduleSchema.index({ equipmentType: 1, isDeleted: 1 });
mineCareServiceScheduleSchema.index({ isDeleted: 1, updated: -1 });

mineCareServiceScheduleSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareServiceScheduleSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareServiceSchedule = model<IMineCareServiceSchedule, IMineCareServiceScheduleModel>('MineCareServiceSchedule', mineCareServiceScheduleSchema);
