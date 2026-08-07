import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export interface IHealthScore extends BaseDocument {
  server: Types.ObjectId;
  score: number;
  status: 'healthy' | 'watch' | 'degraded' | 'critical';
  reasons: string[];
  components: {
    cpu: number;
    memory: number;
    disk: number;
    services: number;
    process: number;
    network: number;
    ssh: number;
  };
  calculatedAt: Date;
  created: Date;
}

const healthScoreSchema = new Schema<IHealthScore>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    score: { type: Number, min: 0, max: 100, required: true, index: true },
    status: {
      type: String,
      enum: ['healthy', 'watch', 'degraded', 'critical'],
      required: true,
      index: true,
    },
    reasons: { type: [String], default: [] },
    components: {
      cpu: { type: Number, default: 100 },
      memory: { type: Number, default: 100 },
      disk: { type: Number, default: 100 },
      services: { type: Number, default: 100 },
      process: { type: Number, default: 100 },
      network: { type: Number, default: 100 },
      ssh: { type: Number, default: 100 },
    },
    calculatedAt: { type: Date, default: Date.now, index: true },
    created: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'health_scores',
  },
);

healthScoreSchema.index({ server: 1, calculatedAt: -1 });

export const HealthScore = model<IHealthScore>('HealthScore', healthScoreSchema);
