import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface ISubMenu {
  name: string;
  route: string;
  iconName: string;
  sequenceNo: number;
  title: string;
  permissionKey: string;
}

export interface IMenu extends BaseDocument {
  iconName: string;
  route: string;
  sequenceNo: number;
  title: string;
  permissionKey: string;
  active: boolean;
  submenu: ISubMenu[];
  created: Date;
  updated: Date;
}

export interface IMenuModel extends Model<IMenu> {
  list(criteria: any): Promise<IMenu[]>;
  totalCount(criteria: any): Promise<number>;
}

const subMenuSchema = new Schema<ISubMenu>({
  name: { type: String, required: true },
  route: { type: String, required: true },
  iconName: { type: String },
  sequenceNo: { type: Number, required: true },
  title: { type: String, required: true },
  permissionKey: { type: String },
}, { _id: false });

const menuSchema = new Schema<IMenu, IMenuModel>(
  {
    iconName: { type: String },
    route: { type: String, required: true },
    sequenceNo: { type: Number, required: true },
    title: { type: String, required: true },
    permissionKey: { type: String },
    active: { type: Boolean, default: true },
    submenu: [subMenuSchema],
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

menuSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

menuSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Menu = model<IMenu, IMenuModel>('Menu', menuSchema);
