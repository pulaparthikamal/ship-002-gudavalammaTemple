import { Schema, model } from 'mongoose';
import type { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface ITableViewColumnPreference {
  columnId: string;
  visible: boolean;
}

export interface ITableViewDefinition {
  id: string;
  name: string;
  columnOrder: string[];
  columns: ITableViewColumnPreference[];
}

export interface ITableViewPreference extends BaseDocument {
  user: ObjectIdType;
  tableId: string;
  activeViewId?: string | null;
  views: ITableViewDefinition[];
  created: Date;
  updated: Date;
}

const tableViewColumnPreferenceSchema = new Schema<ITableViewColumnPreference>(
  {
    columnId: { type: String, required: true, trim: true },
    visible: { type: Boolean, required: true, default: true },
  },
  { _id: false },
);

const tableViewDefinitionSchema = new Schema<ITableViewDefinition>(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    columnOrder: [{ type: String, required: true, trim: true }],
    columns: { type: [tableViewColumnPreferenceSchema], default: [] },
  },
  { _id: false },
);

const tableViewPreferenceSchema = new Schema<ITableViewPreference>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tableId: { type: String, required: true, trim: true, index: true },
    activeViewId: { type: String, default: null, trim: true },
    views: { type: [tableViewDefinitionSchema], default: [] },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  },
);

tableViewPreferenceSchema.index({ user: 1, tableId: 1 }, { unique: true });

tableViewPreferenceSchema.pre('save', function (next) {
  this.updated = new Date();
  next();
});

export const TableViewPreference = model<ITableViewPreference>(
  'TableViewPreference',
  tableViewPreferenceSchema,
);
