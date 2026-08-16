import { Schema, model, Model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export type ExpenseEntryType = 'income' | 'expense';
export type ExpenseEntryPaymentMode = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';

export interface IExpenseEntry extends BaseDocument {
  date: Date;
  eventId?: Types.ObjectId | null;
  category: string;
  description?: string;
  amount: number;
  type: ExpenseEntryType;
  paymentMode: ExpenseEntryPaymentMode;
  attachmentRef?: string;
  createdBy?: Types.ObjectId;
  active: boolean;
  created: Date;
  updated: Date;
}

export interface IExpenseEntryModel extends Model<IExpenseEntry> {
  list(criteria: any): Promise<IExpenseEntry[]>;
  totalCount(criteria: any): Promise<number>;
}

const expenseEntrySchema = new Schema<IExpenseEntry, IExpenseEntryModel>(
  {
    date: { type: Date, required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'ExpenseEvent', default: null },
    category: { type: String, required: true },
    description: { type: String },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    paymentMode: { type: String, enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'other'], default: 'cash' },
    attachmentRef: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

expenseEntrySchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

expenseEntrySchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ExpenseEntry = model<IExpenseEntry, IExpenseEntryModel>('ExpenseEntry', expenseEntrySchema);
