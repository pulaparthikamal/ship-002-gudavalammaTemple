import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface IDashboard extends BaseDocument {
  name: string;
  type: string;
  config: Record<string, any>;
  active: boolean;
  created: Date;
  updated: Date;
}

const dashboardSchema = new Schema<IDashboard>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

export const Dashboard = model<IDashboard>('Dashboard', dashboardSchema);
