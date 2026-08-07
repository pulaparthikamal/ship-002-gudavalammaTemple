import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface ISettings extends BaseDocument {
  key: string;
  value: Schema.Types.Mixed;
  group?: string;
  label?: string;
  isPublic: boolean;
  isEditable: boolean;
  active: boolean;
  created: Date;
  updated: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    group: { type: String },
    label: { type: String },
    isPublic: { type: Boolean, default: false },
    isEditable: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

export const Settings = model<ISettings>('Settings', settingsSchema);
