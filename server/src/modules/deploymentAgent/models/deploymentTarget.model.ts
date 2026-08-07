import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type TargetAuthMethod = 'sshKey' | 'password';
export type TargetStatus = 'pending' | 'connected' | 'unreachable' | 'disabled';
export type NodeInstallStrategy = 'nvm' | 'apt' | 'preinstalled';
export type ReverseProxyConfig = 'nginx-managed' | 'none';
export type PrivilegeEscalation = 'sudo' | 'none';

export interface IDeploymentTarget extends BaseDocument {
  name: string;
  type: 'ssh';
  host: string;
  port: number;
  username: string;
  authMethod: TargetAuthMethod;
  credentialId: Types.ObjectId;
  os: string;
  privilegeEscalation: PrivilegeEscalation;
  baseWebRoot: string;
  nodeInstallStrategy: NodeInstallStrategy;
  reverseProxy: ReverseProxyConfig;
  status: TargetStatus;
  lastConnectedAt?: Date;
  connectionError?: string;
  osVersion?: string;
  nodeVersion?: string;
  pm2Version?: string;
  owner?: Types.ObjectId;
  active: boolean;
  created: Date;
  updated: Date;
}

const deploymentTargetSchema = new Schema<IDeploymentTarget>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['ssh'], default: 'ssh' },
    host: { type: String, required: true, trim: true, index: true },
    port: { type: Number, required: true, default: 22 },
    username: { type: String, required: true, trim: true },
    authMethod: { type: String, enum: ['sshKey', 'password'], required: true },
    credentialId: { type: Schema.Types.ObjectId, ref: 'Credential', required: true, index: true },
    os: { type: String, default: 'ubuntu' },
    privilegeEscalation: { type: String, enum: ['sudo', 'none'], default: 'sudo' },
    baseWebRoot: { type: String, default: '/var/www' },
    nodeInstallStrategy: { type: String, enum: ['nvm', 'apt', 'preinstalled'], default: 'nvm' },
    reverseProxy: { type: String, enum: ['nginx-managed', 'none'], default: 'nginx-managed' },
    status: {
      type: String,
      enum: ['pending', 'connected', 'unreachable', 'disabled'],
      default: 'pending',
      index: true,
    },
    lastConnectedAt: { type: Date },
    connectionError: { type: String },
    osVersion: { type: String },
    nodeVersion: { type: String },
    pm2Version: { type: String },
    owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    active: { type: Boolean, default: true, index: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'deployment_targets',
  }
);

deploymentTargetSchema.index({ host: 1, port: 1, owner: 1 });

export const DeploymentTarget = model<IDeploymentTarget>('DeploymentTarget', deploymentTargetSchema);
