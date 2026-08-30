import { Schema, model, Model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface IExpenseEvent extends BaseDocument {
  name: string;
  startDate?: Date;
  endDate?: Date;
  budget: number;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

export interface IExpenseEventModel extends Model<IExpenseEvent> {
  list(criteria: any): Promise<IExpenseEvent[]>;
  totalCount(criteria: any): Promise<number>;
}

const expenseEventSchema = new Schema<IExpenseEvent, IExpenseEventModel>(
  {
    name: { type: String, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    budget: { type: Number, default: 0 },
    notes: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

expenseEventSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

expenseEventSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ExpenseEvent = model<IExpenseEvent, IExpenseEventModel>('ExpenseEvent', expenseEventSchema);
