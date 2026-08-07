import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface IActivity extends BaseDocument {
  user?: ObjectIdType;
  userName?: string;
  email?: string;
  module?: string;
  action?: string;
  context?: string;
  contextType?: string;
  contextId?: string;
  description?: string;
  ipAddress?: string;
  browserName?: string;
  osName?: string;
  osVersion?: string;
  deviceType?: string;
  loginFrom?: string;
  type?: string; // e.g., EMPLOYEE, USER
  requestJson?: {
    url: string;
    method: string;
    json: {
      body: any;
      params: any;
    };
  };
  created: Date;
}

export interface IActivityModel extends Model<IActivity> {
  list(criteria: any): Promise<IActivity[]>;
  totalCount(criteria: any): Promise<number>;
}

const activitySchema = new Schema<IActivity, IActivityModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    email: { type: String },
    module: { type: String },
    action: { type: String },
    context: { type: String },
    contextType: { type: String },
    contextId: { type: String },
    description: { type: String },
    ipAddress: { type: String },
    browserName: { type: String },
    osName: { type: String },
    osVersion: { type: String },
    deviceType: { type: String },
    loginFrom: { type: String },
    type: { type: String },
    requestJson: {
      url: { type: String },
      method: { type: String },
      json: {
        body: { type: Schema.Types.Mixed },
        params: { type: Schema.Types.Mixed },
      },
    },
    created: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

activitySchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

activitySchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

activitySchema.index({ user: 1 });
activitySchema.index({ module: 1 });
activitySchema.index({ action: 1 });
activitySchema.index({ created: -1 });

export const Activity = model<IActivity, IActivityModel>('Activity', activitySchema);
