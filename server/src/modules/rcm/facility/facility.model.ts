import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IFacility extends BaseDocument {
  facilityId: ObjectIdType;
  facilityName?: string;
  facilityCode?: string;
  npi?: string;
  taxId?: string;
  placeOfServiceCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  fax?: string;
  activeFlag?: boolean;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IFacilityModel extends Model<IFacility> {
  list(criteria: any): Promise<IFacility[]>;
  totalCount(criteria: any): Promise<number>;
}

const facilitySchema = new Schema<IFacility, IFacilityModel>(
  {
    facilityId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    facilityName: { type: String, trim: true },
    facilityCode: { type: String, trim: true },
    npi: { type: String, trim: true },
    taxId: { type: String, trim: true },
    placeOfServiceCode: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    phone: { type: String, trim: true },
    fax: { type: String, trim: true },
    activeFlag: { type: Boolean, default: false },
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

facilitySchema.virtual('createdAt').get(function () {
  return this.created;
});

facilitySchema.virtual('updatedAt').get(function () {
  return this.updated;
});

facilitySchema.index({ isDeleted: 1, updated: -1 });
facilitySchema.index({ facilityName: 1 });
facilitySchema.index({ facilityCode: 1 });

facilitySchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

facilitySchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Facility = model<IFacility, IFacilityModel>('Facility', facilitySchema);