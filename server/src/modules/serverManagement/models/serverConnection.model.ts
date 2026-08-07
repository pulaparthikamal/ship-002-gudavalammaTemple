import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type ServerAuthType = 'password' | 'sshKey';
export type ServerStatus = 'pending' | 'connected' | 'unreachable' | 'disabled';

export interface IServerConnection extends BaseDocument {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: ServerAuthType;
  encryptedPassword?: string;
  encryptedPrivateKey?: string;
  encryptedPassphrase?: string;
  email: string;
  status: ServerStatus;
  lastConnectedAt?: Date;
  lastMetricsAt?: Date;
  lastScanAt?: Date;
  connectionError?: string;
  owner?: Types.ObjectId;
  active: boolean;
  created: Date;
  updated: Date;
}

const serverConnectionSchema = new Schema<IServerConnection>(
  {
    name: { type: String, required: true, trim: true },
    host: { type: String, required: true, trim: true, index: true },
    port: { type: Number, required: true, default: 22 },
    username: { type: String, required: true, trim: true },
    authType: { type: String, enum: ['password', 'sshKey'], required: true },
    encryptedPassword: { type: String },
    encryptedPrivateKey: { type: String },
    encryptedPassphrase: { type: String },
    email: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ['pending', 'connected', 'unreachable', 'disabled'],
      default: 'pending',
      index: true,
    },
    lastConnectedAt: { type: Date },
    lastMetricsAt: { type: Date },
    lastScanAt: { type: Date },
    connectionError: { type: String },
    owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    active: { type: Boolean, default: true, index: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'servers',
  }
);

serverConnectionSchema.index({ host: 1, port: 1, username: 1, owner: 1 });

export const ServerConnection = model<IServerConnection>('ServerConnection', serverConnectionSchema);
