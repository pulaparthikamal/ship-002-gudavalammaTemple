import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export type MineCareObservationSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface IMineCareOperatorObservation extends BaseDocument {
  operatorObservationId: ObjectIdType;
  equipmentId: string;
  observationDate: Date;
  observationType: string;
  description: string;
  severity: MineCareObservationSeverity;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareOperatorObservationModel extends Model<IMineCareOperatorObservation> {
  list(criteria: any): Promise<IMineCareOperatorObservation[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareOperatorObservationSchema = new Schema<IMineCareOperatorObservation, IMineCareOperatorObservationModel>(
  {
    operatorObservationId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    equipmentId: { type: String, required: true, trim: true },
    observationDate: { type: Date, required: true },
    observationType: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
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

mineCareOperatorObservationSchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareOperatorObservationSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareOperatorObservationSchema.index({ equipmentId: 1, observationDate: -1, isDeleted: 1 });
mineCareOperatorObservationSchema.index({ isDeleted: 1, updated: -1 });

mineCareOperatorObservationSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareOperatorObservationSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareOperatorObservation = model<IMineCareOperatorObservation, IMineCareOperatorObservationModel>('MineCareOperatorObservation', mineCareOperatorObservationSchema);
