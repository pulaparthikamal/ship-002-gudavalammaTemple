import crypto from 'crypto';
import { Types } from 'mongoose';
import { Application, IApplication, IComponent } from '../models/application.model';
import { deploymentCrypto } from '../utils/crypto.util';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

export interface ComponentEnvVarInput {
  key: string;
  value: string;
}

export interface ComponentInput {
  key: string;
  type: 'node-api' | 'react-ui' | 'static';
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
  envVars?: ComponentEnvVarInput[];
}

export interface AutoDeployInput {
  enabled: boolean;
  targetId?: string;
  branch?: string;
}

export interface CreateApplicationPayload {
  name: string;
  displayName?: string;
  description?: string;
  repository: {
    url: string;
    provider?: 'github' | 'gitlab' | 'bitbucket' | 'custom';
    authMethod: 'public' | 'sshDeployKey' | 'httpsToken';
    credentialId?: string;
    branch?: string;
  };
  layout: 'monorepo' | 'multi-repo';
  applicationPath?: string;
  components: ComponentInput[];
  defaultTargetId?: string;
  releasesKept?: number;
  autoDeploy?: AutoDeployInput;
  notificationSettings?: {
    notifyOnStart: boolean;
    notifyOnSuccess: boolean;
    notifyOnFailure: boolean;
    notifyOnRollback: boolean;
    additionalRecipients: string[];
  };
  alertEmail?: string;
}

function generatePlainSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

function buildWebhookUrl(appId: string): string {
  const base = process.env.PUBLIC_URL || process.env.API_BASE_URL || '';
  return `${base}/api/v1/deploymentAgent/webhooks/github/${appId}`;
}

const encryptEnvVars = (envVars: ComponentEnvVarInput[] = []) =>
  envVars.map(({ key, value }) => ({
    key,
    encryptedValue: deploymentCrypto.encrypt(value) || '',
  }));

const decryptEnvVarKeys = (component: IComponent) => ({
  ...component,
  envVars: (component.envVars || []).map(({ key }) => ({ key, value: '[encrypted]' })),
});

export const applicationService = {
  async create(payload: CreateApplicationPayload, owner?: Types.ObjectId) {
    const exists = await Application.findOne({ name: payload.name, owner: owner || null, active: true });
    if (exists) {
      throw new AppError(`Application with name "${payload.name}" already exists.`, HTTP_STATUS.CONFLICT);
    }

    const components = payload.components.map((c) => ({
      ...c,
      installCommand: c.installCommand || 'npm ci',
      envVars: encryptEnvVars(c.envVars),
    }));

    const plainSecret = generatePlainSecret();

    const application = await Application.create({
      name: payload.name,
      displayName: payload.displayName || payload.name,
      description: payload.description,
      repository: {
        ...payload.repository,
        branch: payload.repository.branch || 'main',
        credentialId: payload.repository.credentialId
          ? new Types.ObjectId(payload.repository.credentialId)
          : undefined,
      },
      layout: payload.layout,
      applicationPath: payload.applicationPath?.trim() || undefined,
      components,
      defaultTargetId: payload.defaultTargetId
        ? new Types.ObjectId(payload.defaultTargetId)
        : undefined,
      releasesKept: payload.releasesKept || 3,
      autoDeploy: payload.autoDeploy
        ? {
          enabled: payload.autoDeploy.enabled,
          targetId: payload.autoDeploy.targetId
            ? new Types.ObjectId(payload.autoDeploy.targetId)
            : undefined,
          branch: payload.autoDeploy.branch,
        }
        : { enabled: false },
      webhookSecret: deploymentCrypto.encrypt(plainSecret),
      notificationSettings: payload.notificationSettings,
      alertEmail: payload.alertEmail || '',
      owner,
      active: true,
      created: new Date(),
      updated: new Date(),
    });

    return application;
  },

  async list(owner?: Types.ObjectId, query: { page?: string; limit?: string; search?: string } = {}) {
    const filter: Record<string, unknown> = { active: true };
    if (owner) filter.owner = owner;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { displayName: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Application.find(filter).sort({ created: -1 }).skip(skip).limit(limit),
      Application.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  },

  async getById(id: string, owner?: Types.ObjectId) {
    const filter: Record<string, unknown> = { _id: id, active: true };
    if (owner) filter.owner = owner;
    const application = await Application.findOne(filter);
    if (!application) {
      throw new AppError('Application not found.', HTTP_STATUS.NOT_FOUND);
    }
    return application;
  },

  toPublicView(application: IApplication) {
    const obj = application.toObject ? application.toObject() : { ...application };
    delete (obj as any).webhookSecret;
    (obj as any).webhookUrl = buildWebhookUrl(String(application._id));
    (obj as any).hasWebhookSecret = Boolean(application.webhookSecret);
    return obj;
  },

  async update(id: string, payload: Partial<CreateApplicationPayload>, owner?: Types.ObjectId) {
    const application = await this.getById(id, owner);

    if (payload.displayName !== undefined) application.displayName = payload.displayName;
    if (payload.description !== undefined) application.description = payload.description;
    if (payload.layout !== undefined) application.layout = payload.layout;
    if (payload.applicationPath !== undefined) application.applicationPath = payload.applicationPath?.trim() || undefined;
    if (payload.releasesKept !== undefined) application.releasesKept = payload.releasesKept;
    if (payload.defaultTargetId !== undefined) {
      application.defaultTargetId = new Types.ObjectId(payload.defaultTargetId);
    }

    if (payload.repository) {
      const repo = application.repository as any;
      if (payload.repository.url !== undefined) repo.url = payload.repository.url;
      if (payload.repository.provider !== undefined) repo.provider = payload.repository.provider;
      if (payload.repository.authMethod !== undefined) repo.authMethod = payload.repository.authMethod;
      if (payload.repository.branch !== undefined) repo.branch = payload.repository.branch;
      if (payload.repository.credentialId !== undefined) {
        repo.credentialId = new Types.ObjectId(payload.repository.credentialId);
      }
    }

    if (payload.components !== undefined) {
      (application.components as any) = payload.components.map((c) => ({
        ...c,
        installCommand: c.installCommand || 'npm ci',
        envVars: encryptEnvVars(c.envVars),
      }));
    }

    if (payload.autoDeploy !== undefined) {
      (application.autoDeploy as any) = {
        enabled: payload.autoDeploy.enabled,
        targetId: payload.autoDeploy.targetId
          ? new Types.ObjectId(payload.autoDeploy.targetId)
          : undefined,
        branch: payload.autoDeploy.branch,
      };
    }

    if (payload.notificationSettings !== undefined) {
      application.notificationSettings = payload.notificationSettings;
    }
    if (payload.alertEmail !== undefined) {
      application.alertEmail = payload.alertEmail;
    }

    application.updated = new Date();
    await application.save();
    return application;
  },

  async remove(id: string, owner?: Types.ObjectId) {
    const application = await this.getById(id, owner);
    application.active = false;
    application.updated = new Date();
    await application.save();
    return id;
  },

  async rotateWebhookSecret(id: string, owner?: Types.ObjectId): Promise<string> {
    const application = await this.getById(id, owner);
    const plainSecret = generatePlainSecret();
    application.webhookSecret = deploymentCrypto.encrypt(plainSecret) || '';
    application.updated = new Date();
    await application.save();
    return plainSecret;
  },

  getDecryptedWebhookSecret(application: IApplication): string | undefined {
    return deploymentCrypto.decrypt(application.webhookSecret);
  },

  async updateAutoDeploy(id: string, autoDeploy: AutoDeployInput, owner?: Types.ObjectId) {
    const application = await this.getById(id, owner);
    (application.autoDeploy as any) = {
      enabled: autoDeploy.enabled,
      targetId: autoDeploy.targetId ? new Types.ObjectId(autoDeploy.targetId) : undefined,
      branch: autoDeploy.branch,
    };
    application.updated = new Date();
    await application.save();
    return application;
  },

  getDecryptedEnvVars(application: IApplication, componentKey: string) {
    const component = application.components.find((c) => c.key === componentKey);
    if (!component) {
      throw new AppError(`Component "${componentKey}" not found in application.`, HTTP_STATUS.NOT_FOUND);
    }
    return component.envVars.map(({ key, encryptedValue }) => ({
      key,
      value: deploymentCrypto.decrypt(encryptedValue) || '',
    }));
  },
};
