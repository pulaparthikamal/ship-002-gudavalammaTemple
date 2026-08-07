import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IChargeMaster extends BaseDocument {
  chargeMasterId: ObjectIdType;
  cptCode?: string;
  description?: string;
  revenueCode?: string;
  defaultChargeAmount?: number;
  defaultAllowedAmount?: number;
  placeOfService?: string;
  modifiersAllowed?: string[];
  diagnosisRestrictions?: string[];
  effectiveDate?: Date;
  terminationDate?: Date;
  activeFlag?: boolean;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IChargeMasterModel extends Model<IChargeMaster> {
  list(criteria: any): Promise<IChargeMaster[]>;
  totalCount(criteria: any): Promise<number>;
}

const chargeMasterSchema = new Schema<IChargeMaster, IChargeMasterModel>(
  {
    chargeMasterId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    cptCode: { type: String, trim: true },
    description: { type: String, trim: true },
    revenueCode: { type: String, trim: true },
    defaultChargeAmount: { type: Number },
    defaultAllowedAmount: { type: Number },
    placeOfService: { type: String, trim: true },
    modifiersAllowed: { type: [String], default: [] },
    diagnosisRestrictions: { type: [String], default: [] },
    effectiveDate: { type: Date },
    terminationDate: { type: Date },
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

chargeMasterSchema.virtual('createdAt').get(function () {
  return this.created;
});

chargeMasterSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

chargeMasterSchema.index({ isDeleted: 1, updated: -1 });
chargeMasterSchema.index({ cptCode: 1 });
chargeMasterSchema.index({ description: 1 });

chargeMasterSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

chargeMasterSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ChargeMaster = model<IChargeMaster, IChargeMasterModel>('ChargeMaster', chargeMasterSchema);