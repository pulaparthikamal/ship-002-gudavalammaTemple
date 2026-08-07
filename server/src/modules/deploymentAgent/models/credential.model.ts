import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type CredentialType = 'sshKey' | 'httpsToken' | 'password';

export interface ICredential extends BaseDocument {
  name: string;
  type: CredentialType;
  encryptedValue: string;
  encryptedPassphrase?: string;
  description?: string;
  owner?: Types.ObjectId;
  active: boolean;
  created: Date;
  updated: Date;
}

const credentialSchema = new Schema<ICredential>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['sshKey', 'httpsToken', 'password'],
      required: true,
    },
    encryptedValue: { type: String, required: true },
    encryptedPassphrase: { type: String },
    description: { type: String, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    active: { type: Boolean, default: true, index: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'deployment_credentials',
  }
);

export const Credential = model<ICredential>('Credential', credentialSchema);
