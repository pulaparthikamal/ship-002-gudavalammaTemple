import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type ComponentType = 'node-api' | 'react-ui' | 'static';
export type RepoAuthMethod = 'public' | 'sshDeployKey' | 'httpsToken';
export type RepoProvider = 'github' | 'gitlab' | 'bitbucket' | 'custom';
export type AppLayout = 'monorepo' | 'multi-repo';

export interface IComponentEnvVar {
  key: string;
  encryptedValue: string;
}

export interface IComponent {
  key: string;
  type: ComponentType;
  sourcePath?: string;
  repoUrl?: string;
  nodeVersion?: string;
  installCommand?: string;
  buildCommand?: string;
  buildOutputDir?: string;
  startCommand?: string;
  port?: number;
  deployPath?: string;
  healthCheckPath?: string;
  healthCheckUrl?: string;
  envVars: IComponentEnvVar[];
}

export interface IRepository {
  url: string;
  provider: RepoProvider;
  authMethod: RepoAuthMethod;
  credentialId?: Types.ObjectId;
  branch: string;
}

export interface IAutoDeploy {
  enabled: boolean;
  targetId?: Types.ObjectId;
  branch?: string;
}

export interface INotificationSettings {
  notifyOnStart: boolean;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  notifyOnRollback: boolean;
  additionalRecipients: string[];
}

export interface IApplication extends BaseDocument {
  name: string;
  displayName: string;
  description?: string;
  repository: IRepository;
  layout: AppLayout;
  applicationPath?: string;
  components: IComponent[];
  defaultTargetId?: Types.ObjectId;
  releasesKept: number;
  autoDeploy?: IAutoDeploy;
  webhookSecret?: string;
  owner?: Types.ObjectId;
  active: boolean;
  notificationSettings?: INotificationSettings;
  alertEmail?: string;
  created: Date;
  updated: Date;
}

const componentEnvVarSchema = new Schema<IComponentEnvVar>(
  {
    key: { type: String, required: true, trim: true },
    encryptedValue: { type: String, required: true },
  },
  { _id: false }
);

const componentSchema = new Schema<IComponent>(
  {
    key: { type: String, required: true, trim: true },
    type: { type: String, enum: ['node-api', 'react-ui', 'static'], required: true },
    sourcePath: { type: String, trim: true },
    repoUrl: { type: String, trim: true },
    nodeVersion: { type: String, trim: true },
    installCommand: { type: String, trim: true, default: 'npm ci' },
    buildCommand: { type: String, trim: true },
    buildOutputDir: { type: String, trim: true },
    startCommand: { type: String, trim: true },
    port: { type: Number },
    deployPath: { type: String, trim: true },
    healthCheckPath: { type: String, trim: true },
    healthCheckUrl: { type: String, trim: true },
    envVars: { type: [componentEnvVarSchema], default: [] },
  },
  { _id: false }
);

const repositorySchema = new Schema<IRepository>(
  {
    url: { type: String, required: true, trim: true },
    provider: { type: String, enum: ['github', 'gitlab', 'bitbucket', 'custom'], default: 'github' },
    authMethod: { type: String, enum: ['public', 'sshDeployKey', 'httpsToken'], required: true },
    credentialId: { type: Schema.Types.ObjectId, ref: 'Credential' },
    branch: { type: String, trim: true, default: 'main' },
  },
  { _id: false }
);

const autoDeploySchema = new Schema<IAutoDeploy>(
  {
    enabled: { type: Boolean, default: false },
    targetId: { type: Schema.Types.ObjectId, ref: 'DeploymentTarget' },
    branch: { type: String, trim: true },
  },
  { _id: false }
);

const notificationSettingsSchema = new Schema<INotificationSettings>(
  {
    notifyOnStart: { type: Boolean, default: true },
    notifyOnSuccess: { type: Boolean, default: true },
    notifyOnFailure: { type: Boolean, default: true },
    notifyOnRollback: { type: Boolean, default: true },
    additionalRecipients: { type: [String], default: [] },
  },
  { _id: false }
);

const applicationSchema = new Schema<IApplication>(
  {
    name: { type: String, required: true, trim: true, index: true },
    displayName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    repository: { type: repositorySchema, required: true },
    layout: { type: String, enum: ['monorepo', 'multi-repo'], required: true },
    applicationPath: { type: String, trim: true },
    components: { type: [componentSchema], required: true },
    defaultTargetId: { type: Schema.Types.ObjectId, ref: 'DeploymentTarget' },
    releasesKept: { type: Number, default: 3, min: 1, max: 20 },
    autoDeploy: { type: autoDeploySchema },
    webhookSecret: { type: String },
    owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    active: { type: Boolean, default: true, index: true },
    notificationSettings: { type: notificationSettingsSchema, default: () => ({}) },
    alertEmail: { type: String, trim: true, default: '' },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'deployment_applications',
  }
);

applicationSchema.index({ name: 1, owner: 1 }, { unique: true });

export const Application = model<IApplication>('Application', applicationSchema);
