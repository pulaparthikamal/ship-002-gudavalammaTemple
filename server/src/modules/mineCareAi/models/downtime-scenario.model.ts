import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareDowntimeScenario extends BaseDocument {
  scenarioId: string;
  equipmentId: string;
  equipmentName: string;
  expectedDowntimeHours: number;
  productionLossPerHour: number;
  dependentProcesses: string[];
  failureProbability: number;
  repairDelayDays: number;
  productionLoss: number;
  riskLevel: string;
  recommendedAction: string;
  recoveryPlan?: string[];
  mitigationOptions?: string[];
  impactExplanation?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareDowntimeScenarioModel extends Model<IMineCareDowntimeScenario> {
  list(criteria: any): Promise<IMineCareDowntimeScenario[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareDowntimeScenarioSchema = new Schema<IMineCareDowntimeScenario, IMineCareDowntimeScenarioModel>(
  {
    scenarioId: { type: String, required: true, unique: true, index: true, trim: true },
    equipmentId: { type: String, required: true, index: true, trim: true },
    equipmentName: { type: String, trim: true },
    expectedDowntimeHours: { type: Number, default: 0 },
    productionLossPerHour: { type: Number, default: 0 },
    dependentProcesses: { type: [String], default: [] },
    failureProbability: { type: Number, default: 0 },
    repairDelayDays: { type: Number, default: 0 },
    productionLoss: { type: Number, default: 0 },
    riskLevel: { type: String, default: 'Low', trim: true },
    recommendedAction: { type: String, trim: true },
    recoveryPlan: { type: [String], default: [] },
    mitigationOptions: { type: [String], default: [] },
    impactExplanation: { type: String, trim: true },
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
mineCareDowntimeScenarioSchema.index({ isDeleted: 1, updated: -1 });
mineCareDowntimeScenarioSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareDowntimeScenarioSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };
export const MineCareDowntimeScenario = model<IMineCareDowntimeScenario, IMineCareDowntimeScenarioModel>('MineCareDowntimeScenario', mineCareDowntimeScenarioSchema);
