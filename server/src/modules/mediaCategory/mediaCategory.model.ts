import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface IMediaCategory extends BaseDocument {
  name: string;
  content?: string;
  topicUrls?: string[];
  videoUrl?: string;
  imageUrl?: string;
  description?: string;
  interestedTopics?: string[];
  additionalInformation?: Record<string, any> | null;
  frequencyOfPublishing?: number;
  tone?: string;
  platform?: string;
  enable?: Record<string, boolean>;
  isUploaded: boolean;
  scheduledDate?: Date;
  active: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: ObjectIdType;
  createdByName?: string;
  updatedBy?: ObjectIdType;
  updatedByName?: string;
  created: Date;
  updated: Date;
}

export interface IMediaCategoryModel extends Model<IMediaCategory> {
  list(criteria: any): Promise<IMediaCategory[]>;
  totalCount(criteria: any): Promise<number>;
}

const mediaCategorySchema = new Schema<IMediaCategory, IMediaCategoryModel>(
  {
    name: { type: String, required: true, trim: true },
    content: { type: String, trim: true },
    topicUrls: [{ type: String }],
    videoUrl: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    description: { type: String, trim: true },
    interestedTopics: [{ type: String, trim: true }],
    additionalInformation: { type: Schema.Types.Mixed, default: null },
    frequencyOfPublishing: { type: Number },
    tone: { type: String, trim: true },
    platform: { type: String, trim: true },
    enable: {
      type: Map,
      of: Boolean,
      default: {
        youtube: false,
        facebook: false,
        instagram: false,
        linkedin: false,
      },
    },
    isUploaded: { type: Boolean, default: false },
    scheduledDate: { type: Date },
    active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

/**
 * Static Methods
 */
mediaCategorySchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mediaCategorySchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MediaCategory = model<IMediaCategory, IMediaCategoryModel>('MediaCategory', mediaCategorySchema);
