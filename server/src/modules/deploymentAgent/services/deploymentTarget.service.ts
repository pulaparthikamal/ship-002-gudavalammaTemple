import { Types } from 'mongoose';
import { DeploymentTarget, IDeploymentTarget } from '../models/deploymentTarget.model';
import { credentialService } from './credential.service';
import { sshUtil } from '../utils/ssh.util';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

export interface CreateDeploymentTargetPayload {
  name: string;
  host: string;
  port?: number;
  username: string;
  authMethod: 'sshKey' | 'password';
  credentialId: string;
  os?: string;
  privilegeEscalation?: 'sudo' | 'none';
  baseWebRoot?: string;
  nodeInstallStrategy?: 'nvm' | 'apt' | 'preinstalled';
  reverseProxy?: 'nginx-managed' | 'none';
  verifyConnection?: boolean;
}

export const deploymentTargetService = {
  async create(payload: CreateDeploymentTargetPayload, owner?: Types.ObjectId) {
    const target = await DeploymentTarget.create({
      name: payload.name,
      type: 'ssh',
      host: payload.host,
      port: payload.port || 22,
      username: payload.username,
      authMethod: payload.authMethod,
      credentialId: new Types.ObjectId(payload.credentialId),
      os: payload.os || 'ubuntu',
      privilegeEscalation: payload.privilegeEscalation || 'sudo',
      baseWebRoot: payload.baseWebRoot || '/var/www',
      nodeInstallStrategy: payload.nodeInstallStrategy || 'nvm',
      reverseProxy: payload.reverseProxy || 'nginx-managed',
      status: 'pending',
      owner,
      active: true,
      created: new Date(),
      updated: new Date(),
    });

    if (payload.verifyConnection) {
      await this._testAndUpdateStatus(target);
    }

    return target;
  },

  async list(owner?: Types.ObjectId) {
    const query: Record<string, unknown> = { active: true };
    if (owner) query.owner = owner;
    return DeploymentTarget.find(query).sort({ created: -1 });
  },

  async getById(id: string, owner?: Types.ObjectId) {
    const query: Record<string, unknown> = { _id: id, active: true };
    if (owner) query.owner = owner;
    const target = await DeploymentTarget.findOne(query);
    if (!target) {
      throw new AppError('Deployment target not found.', HTTP_STATUS.NOT_FOUND);
    }
    return target;
  },

  async update(id: string, payload: Partial<CreateDeploymentTargetPayload>, owner?: Types.ObjectId) {
    const target = await this.getById(id, owner);
    const fields: (keyof CreateDeploymentTargetPayload)[] = [
      'name', 'host', 'username', 'os', 'privilegeEscalation',
      'baseWebRoot', 'nodeInstallStrategy', 'reverseProxy',
    ];
    for (const field of fields) {
      if (payload[field] !== undefined) {
        (target as any)[field] = payload[field];
      }
    }
    if (payload.port !== undefined) target.port = payload.port;
    if (payload.authMethod !== undefined) target.authMethod = payload.authMethod;
    if (payload.credentialId !== undefined) target.credentialId = new Types.ObjectId(payload.credentialId);
    target.updated = new Date();
    await target.save();
    return target;
  },

  async remove(id: string, owner?: Types.ObjectId) {
    const target = await this.getById(id, owner);
    target.active = false;
    target.updated = new Date();
    await target.save();
    return id;
  },

  async testConnection(id: string, owner?: Types.ObjectId) {
    const target = await this.getById(id, owner);
    return this._testAndUpdateStatus(target);
  },

  async getSshConfig(target: IDeploymentTarget) {
    const cred = await credentialService.getDecrypted(String(target.credentialId));
    return {
      host: target.host,
      port: target.port,
      username: target.username,
      privateKey: cred.type === 'sshKey' ? cred.value : undefined,
      passphrase: cred.passphrase,
      password: cred.type === 'password' ? cred.value : undefined,
    };
  },

  async _testAndUpdateStatus(target: IDeploymentTarget) {
    try {
      const config = await this.getSshConfig(target);
      const result = await sshUtil.executeOnce(config, 'hostname && uptime', 15000);
      
      if (result.code === 0) {
        target.status = 'connected';
        target.connectionError = undefined;

        // Query OS Version
        const osRes = await sshUtil.executeOnce(config, 'uname -sr || cat /etc/redhat-release || cat /etc/issue', 10000);
        target.osVersion = osRes.code === 0 ? osRes.stdout.trim() : 'Unknown OS';

        // Query Node Version
        const nodeRes = await sshUtil.executeOnce(config, 'node -v', 10000);
        let nodeVer = nodeRes.code === 0 ? nodeRes.stdout.trim() : '';
        if (!nodeVer && target.nodeInstallStrategy === 'nvm') {
          const nvmNodeRes = await sshUtil.executeOnce(config, 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use lts/* >/dev/null 2>&1 && node -v', 10000);
          nodeVer = nvmNodeRes.code === 0 ? nvmNodeRes.stdout.trim() : 'Not installed';
        }
        target.nodeVersion = nodeVer || 'Not installed';

        // Query PM2 Version
        const pm2Res = await sshUtil.executeOnce(config, 'pm2 -v', 10000);
        let pm2Ver = pm2Res.code === 0 ? pm2Res.stdout.trim() : '';
        if (!pm2Ver && target.nodeInstallStrategy === 'nvm') {
          const nvmPm2Res = await sshUtil.executeOnce(config, 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use lts/* >/dev/null 2>&1 && pm2 -v', 10000);
          pm2Ver = nvmPm2Res.code === 0 ? nvmPm2Res.stdout.trim() : 'Not installed';
        }
        target.pm2Version = pm2Ver || 'Not installed';
      } else {
        target.status = 'unreachable';
        target.connectionError = result.stderr.trim() || 'SSH handshake failed.';
      }
      target.lastConnectedAt = new Date();
    } catch (err) {
      target.status = 'unreachable';
      target.connectionError = err instanceof Error ? err.message : 'SSH connection failed.';
    }
    target.updated = new Date();
    await target.save();
    return { status: target.status, connectionError: target.connectionError };
  },
};
