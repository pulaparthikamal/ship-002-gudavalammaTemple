import { Schema, model, Model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface IPermissionItem {
  type: string;
  actions: string[];
}

export interface IRole extends BaseDocument {
  role: string;
  roleType: string;
  status: string;
  active: boolean;
  permissions: Record<string, IPermissionItem>;
  created: Date;
  updated: Date;
}

export interface IRoleModel extends Model<IRole> {
  list(criteria: any): Promise<IRole[]>;
  totalCount(criteria: any): Promise<number>;
}

const permissionItemSchema = new Schema<IPermissionItem>(
  {
    type: { type: String, required: true },
    actions: [{ type: String }],
  },
  { _id: false }
);

const roleSchema = new Schema<IRole, IRoleModel>(
  {
    role: { type: String, required: true, unique: true },
    roleType: { type: String, required: true },
    status: { type: String, default: 'Active' },
    active: { type: Boolean, default: true },
    permissions: {
      type: Map,
      of: permissionItemSchema,
      default: {},
    },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

roleSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

roleSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Role = model<IRole, IRoleModel>('Role', roleSchema);
