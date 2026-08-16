import { Schema, model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export type AnalyticsEventType = 'pageview' | 'click' | 'funnel_step';

export interface IAnalyticsEvent extends BaseDocument {
  sessionId: string;
  userId?: Types.ObjectId;
  path: string;
  eventType: AnalyticsEventType;
  targetLabel?: string;
  funnelName?: string;
  stepIndex?: number;
  stepName?: string;
  durationMs?: number;
  timestamp: Date;
  created: Date;
}

const analyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    path: { type: String, required: true },
    eventType: { type: String, enum: ['pageview', 'click', 'funnel_step'], required: true },
    targetLabel: { type: String },
    funnelName: { type: String },
    stepIndex: { type: Number },
    stepName: { type: String },
    durationMs: { type: Number },
    timestamp: { type: Date, required: true },
    created: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

analyticsEventSchema.index({ eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ funnelName: 1, timestamp: -1 });
analyticsEventSchema.index({ path: 1, timestamp: -1 });

export const AnalyticsEvent = model<IAnalyticsEvent>('AnalyticsEvent', analyticsEventSchema);
