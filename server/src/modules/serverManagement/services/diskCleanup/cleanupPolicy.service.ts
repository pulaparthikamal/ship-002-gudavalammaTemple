import { Types } from 'mongoose';
import { HTTP_STATUS } from '../../../../constants/httpStatus.constants';
import { AppError } from '../../../../utils/error.util';
import { DiskCleanupPolicy, IDiskCleanupPolicy } from '../../models/diskCleanup.model';

export const defaultCleanupPaths = ['/var/log', '/tmp', '/var/tmp'];
const forbiddenExactPaths = new Set(['/', '/boot', '/bin', '/sbin', '/usr', '/usr/bin', '/usr/sbin', '/lib', '/lib64', '/etc', '/proc', '/sys', '/dev', '/run']);
const shellMetacharacters = /[*?[\]{};$`|&<>]/;

export interface CleanupPolicyPayload {
  serverId: string;
  enabled?: boolean;
  allowlistedPaths?: string[];
  logRetentionDays?: number;
  tempRetentionDays?: number;
  warningThresholdPercent?: number;
  criticalThresholdPercent?: number;
  emergencyThresholdPercent?: number;
  archiveBeforeDelete?: boolean;
  dryRun?: boolean;
  maxDeleteSizePerRun?: number;
  cronEnabled?: boolean;
  cronExpression?: string;
}

export const normalizeCleanupPath = (value: string) => {
  const normalized = value.trim().replace(/\/+$/, '');
  return normalized || '/';
};

export const isValidCleanupPath = (value: string) => {
  const normalized = normalizeCleanupPath(value);
  if (!normalized.startsWith('/')) return false;
  if (normalized.includes('..')) return false;
  if (forbiddenExactPaths.has(normalized)) return false;
  if (shellMetacharacters.test(normalized)) return false;
  return normalized.length > 1;
};

export const isPathWithinAllowlist = (filePath: string, allowlistedPaths: string[]) => {
  const normalizedFilePath = normalizeCleanupPath(filePath);
  return allowlistedPaths.some((root) => {
    const normalizedRoot = normalizeCleanupPath(root);
    return normalizedFilePath === normalizedRoot || normalizedFilePath.startsWith(`${normalizedRoot}/`);
  });
};

const validatePercent = (value: number, name: string) => {
  if (!Number.isFinite(value) || value < 1 || value > 100) {
    throw new AppError(`${name} must be between 1 and 100.`, HTTP_STATUS.BAD_REQUEST);
  }
};

export const cleanupPolicyService = {
  validate(payload: CleanupPolicyPayload) {
    const allowlistedPaths = Array.from(
      new Set((payload.allowlistedPaths?.length ? payload.allowlistedPaths : defaultCleanupPaths).map(normalizeCleanupPath)),
    );
    if (!allowlistedPaths.every(isValidCleanupPath)) {
      throw new AppError('Cleanup allowlisted paths must be absolute, specific, and free of traversal or shell metacharacters.', HTTP_STATUS.BAD_REQUEST);
    }

    const logRetentionDays = Math.max(1, Math.min(Number(payload.logRetentionDays ?? 7), 3650));
    const tempRetentionDays = Math.max(1, Math.min(Number(payload.tempRetentionDays ?? 3), 3650));
    const warningThresholdPercent = Number(payload.warningThresholdPercent ?? 75);
    const criticalThresholdPercent = Number(payload.criticalThresholdPercent ?? 85);
    const emergencyThresholdPercent = Number(payload.emergencyThresholdPercent ?? 90);
    validatePercent(warningThresholdPercent, 'warningThresholdPercent');
    validatePercent(criticalThresholdPercent, 'criticalThresholdPercent');
    validatePercent(emergencyThresholdPercent, 'emergencyThresholdPercent');
    if (!(warningThresholdPercent < criticalThresholdPercent && criticalThresholdPercent <= emergencyThresholdPercent)) {
      throw new AppError('Cleanup thresholds must be ordered warning < critical <= emergency.', HTTP_STATUS.BAD_REQUEST);
    }

    return {
      enabled: payload.enabled ?? true,
      allowlistedPaths,
      logRetentionDays,
      tempRetentionDays,
      warningThresholdPercent,
      criticalThresholdPercent,
      emergencyThresholdPercent,
      archiveBeforeDelete: payload.archiveBeforeDelete ?? false,
      dryRun: payload.dryRun ?? true,
      maxDeleteSizePerRun: Math.max(1024 * 1024, Number(payload.maxDeleteSizePerRun ?? 2 * 1024 * 1024 * 1024)),
      cronEnabled: payload.cronEnabled ?? true,
      cronExpression: payload.cronExpression || '0 2 * * *',
    };
  },

  async get(serverId: string) {
    const serverObjectId = new Types.ObjectId(serverId);
    const existing = await DiskCleanupPolicy.findOne({ serverId: serverObjectId });
    if (existing) {
      return existing;
    }

    return DiskCleanupPolicy.create({
      serverId: serverObjectId,
      ...this.validate({ serverId }),
    });
  },

  async save(payload: CleanupPolicyPayload) {
    const serverObjectId = new Types.ObjectId(payload.serverId);
    const normalized = this.validate(payload);
    return DiskCleanupPolicy.findOneAndUpdate(
      { serverId: serverObjectId },
      { serverId: serverObjectId, ...normalized, updatedAt: new Date() },
      { upsert: true, new: true },
    );
  },

  async listActiveCronPolicies() {
    return DiskCleanupPolicy.find({ enabled: true, cronEnabled: true }).lean<IDiskCleanupPolicy[]>();
  },
};
