import mongoose, { Schema, model, Model } from 'mongoose';
import crypto from 'crypto';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface IUser extends BaseDocument {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  salt?: string;
  forgotPasswordExpireTimeStamp?: number;
  photo?: string[];
  base32Secrect?: string;
  role: ObjectIdType; // Reference to Role model
  created: Date;
  updated: Date;
  firstTimeLogin?: boolean;
  active: boolean;
  createdBy?: ObjectIdType;
  createdByName?: string;
  updatedBy?: ObjectIdType;
  updatedByName?: string;
  listPreferences?: ObjectIdType;
  isTwoFactorAuthentication: boolean;
  otp?: string;
  otpExpires?: Date;
  isRemember: boolean;
  isRememberLogin?: Date;
  enableTwoFactAuth: boolean;
  photoUrl?: string;
  isGoogleUser?: boolean;
  reportingTo?: ObjectIdType;
  reportingToSearch?: string;
  isEmailVerified: boolean;
  profileImage?: string;
  phone?: string;
  isDeleted: boolean;
  deletedAt?: Date;

  // Methods
  authenticate(password: string): boolean;
  hashPassword(password: string): string;
}

export interface IUserModel extends Model<IUser> {
  list(criteria: any): Promise<IUser[]>;
  totalCount(criteria: any): Promise<number>;
}

const userSchema = new Schema<IUser, IUserModel>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    salt: { type: String },
    forgotPasswordExpireTimeStamp: { type: Number },
    photo: [{ type: String }],
    base32Secrect: { type: String },
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    firstTimeLogin: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String },
    listPreferences: { type: Schema.Types.ObjectId, ref: 'ListPreferences' },
    isTwoFactorAuthentication: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    isRemember: { type: Boolean, default: false },
    isRememberLogin: { type: Date },
    enableTwoFactAuth: { type: Boolean, default: true },
    photoUrl: { type: String },
    isGoogleUser: { type: Boolean, default: false },
    reportingTo: { type: Schema.Types.ObjectId, ref: 'User' },
    reportingToSearch: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    profileImage: { type: String },
    phone: { type: String },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: false,
  }
);

/**
 * Pre-save hook to hash password
 */
userSchema.pre('save', function (next) {
  if (this.password && this.isModified('password')) {
    this.salt = crypto.randomBytes(16).toString('base64');
    this.password = this.hashPassword(this.password);
  }
  next();
});

/**
 * Instance Methods
 */
userSchema.methods.authenticate = function (password: string): boolean {
  return this.password === this.hashPassword(password);
};

userSchema.methods.hashPassword = function (password: string): string {
  if (this.salt && password) {
    return crypto
      .pbkdf2Sync(
        password,
        Buffer.from(this.salt, 'base64'),
        10000,
        64,
        'SHA1'
      )
      .toString('base64');
  }
  return password;
};

/**
 * Static Methods
 */
userSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

userSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const User = model<IUser, IUserModel>('User', userSchema);
