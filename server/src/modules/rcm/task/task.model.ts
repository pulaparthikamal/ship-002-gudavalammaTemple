import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface ITask extends BaseDocument {
  taskId: ObjectIdType;
  entityId?: ObjectIdType;
  entityType?: string;
  workflowStage?: string;
  assignedTo?: string;
  assignedTeam?: string;
  priority?: string;
  status?: string;
  dueDate?: Date;
  slaTimer?: Date;
  escalationFlag?: boolean;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface ITaskModel extends Model<ITask> {
  list(criteria: any): Promise<ITask[]>;
  totalCount(criteria: any): Promise<number>;
}

const taskSchema = new Schema<ITask, ITaskModel>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    entityId: { type: Schema.Types.ObjectId },
    entityType: { type: String, trim: true },
    workflowStage: { type: String, trim: true },
    assignedTo: { type: String, trim: true },
    assignedTeam: { type: String, trim: true },
    priority: { type: String, trim: true },
    status: { type: String, trim: true },
    dueDate: { type: Date },
    slaTimer: { type: Date },
    escalationFlag: { type: Boolean, default: false },
    notes: { type: String, trim: true },
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

taskSchema.virtual('createdAt').get(function () {
  return this.created;
});

taskSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

taskSchema.index({ isDeleted: 1, updated: -1 });
taskSchema.index({ workflowStage: 1 });
taskSchema.index({ status: 1 });

taskSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

taskSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Task = model<ITask, ITaskModel>('Task', taskSchema);
