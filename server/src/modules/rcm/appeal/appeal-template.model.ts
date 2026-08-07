import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IAppealTemplate extends BaseDocument {
  templateId: ObjectIdType;
  templateName: string;
  templateType: string;
  templateVersion: number;
  bodyTemplate: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IAppealTemplateModel extends Model<IAppealTemplate> {
  list(criteria: any): Promise<IAppealTemplate[]>;
  totalCount(criteria: any): Promise<number>;
}

const appealTemplateSchema = new Schema<IAppealTemplate, IAppealTemplateModel>(
  {
    templateId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    templateName: { type: String, trim: true, required: true },
    templateType: { type: String, trim: true, required: true, index: true },
    templateVersion: { type: Number, default: 1 },
    bodyTemplate: { type: String, trim: true, required: true },
    active: { type: Boolean, default: true, index: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

appealTemplateSchema.virtual('createdAt').get(function () {
  return this.created;
});

appealTemplateSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

appealTemplateSchema.index({ isDeleted: 1, active: 1, templateType: 1, templateVersion: -1 });

appealTemplateSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

appealTemplateSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const AppealTemplate = model<IAppealTemplate, IAppealTemplateModel>('AppealTemplate', appealTemplateSchema);
