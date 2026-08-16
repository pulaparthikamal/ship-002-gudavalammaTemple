import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface IAnalyticsCountEntry {
  key: string;
  count: number;
}

export interface IAnalyticsFunnelStepCount {
  stepIndex: number;
  stepName: string;
  count: number;
}

export interface IAnalyticsFunnelRollup {
  funnelName: string;
  steps: IAnalyticsFunnelStepCount[];
}

export interface IAnalyticsDailyRollup extends BaseDocument {
  date: string; // 'YYYY-MM-DD', UTC calendar day
  totalPageviews: number;
  totalClicks: number;
  uniqueSessions: number;
  topPages: IAnalyticsCountEntry[];
  topClicks: IAnalyticsCountEntry[];
  funnels: IAnalyticsFunnelRollup[];
  created: Date;
  updated: Date;
}

const countEntrySchema = new Schema<IAnalyticsCountEntry>({ key: String, count: Number }, { _id: false });

const funnelStepSchema = new Schema<IAnalyticsFunnelStepCount>(
  { stepIndex: Number, stepName: String, count: Number },
  { _id: false }
);

const funnelRollupSchema = new Schema<IAnalyticsFunnelRollup>(
  { funnelName: String, steps: [funnelStepSchema] },
  { _id: false }
);

const analyticsDailyRollupSchema = new Schema<IAnalyticsDailyRollup>(
  {
    date: { type: String, required: true, unique: true },
    totalPageviews: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    uniqueSessions: { type: Number, default: 0 },
    topPages: { type: [countEntrySchema], default: [] },
    topClicks: { type: [countEntrySchema], default: [] },
    funnels: { type: [funnelRollupSchema], default: [] },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const AnalyticsDailyRollup = model<IAnalyticsDailyRollup>('AnalyticsDailyRollup', analyticsDailyRollupSchema);
