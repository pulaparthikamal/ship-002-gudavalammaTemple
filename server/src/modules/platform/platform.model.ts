import mongoose, { Schema, model, Document } from 'mongoose';

export interface IPlatform extends Document {
  name: string;
  icon?: string;
  color?: string;
  svg?: string;
  active: boolean;
}

const platformSchema = new Schema<IPlatform>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, trim: true },
    color: { type: String, trim: true },
    svg: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const Platform = model<IPlatform>('Platform', platformSchema);
