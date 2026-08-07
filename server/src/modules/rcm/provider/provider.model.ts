import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IProvider extends BaseDocument {
  providerId: ObjectIdType;
  firstName?: string;
  lastName?: string;
  credentials?: string;
  specialty?: string;
  npi?: string;
  taxId?: string;
  taxonomyCode?: string;
  licenseNumber?: string;
  deaNumber?: string;
  providerType?: string;
  phone?: string;
  fax?: string;
  email?: string;
  activeFlag?: boolean;
  billingProviderFlag?: boolean;
  renderingProviderFlag?: boolean;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IProviderModel extends Model<IProvider> {
  list(criteria: any): Promise<IProvider[]>;
  totalCount(criteria: any): Promise<number>;
}

const providerSchema = new Schema<IProvider, IProviderModel>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    credentials: { type: String, trim: true },
    specialty: { type: String, trim: true },
    npi: { type: String, trim: true },
    taxId: { type: String, trim: true },
    taxonomyCode: { type: String, trim: true },
    licenseNumber: { type: String, trim: true },
    deaNumber: { type: String, trim: true },
    providerType: { type: String, trim: true },
    phone: { type: String, trim: true },
    fax: { type: String, trim: true },
    email: { type: String, trim: true },
    activeFlag: { type: Boolean, default: false },
    billingProviderFlag: { type: Boolean, default: false },
    renderingProviderFlag: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
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

providerSchema.virtual('createdAt').get(function () {
  return this.created;
});

providerSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

providerSchema.index({ isDeleted: 1, updated: -1 });
providerSchema.index({ firstName: 1 });
providerSchema.index({ lastName: 1 });

providerSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

providerSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Provider = model<IProvider, IProviderModel>('Provider', providerSchema);
