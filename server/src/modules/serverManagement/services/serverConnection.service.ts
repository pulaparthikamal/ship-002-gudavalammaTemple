import { Types } from 'mongoose';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { AppError } from '../../../utils/error.util';
import { secretCrypto } from '../utils/crypto.util';
import { ServerConnection } from '../models/serverConnection.model';
import { ServerMaintenanceConfig } from '../models/config.model';
import { configService } from './config.service';
import { sshService } from './ssh.service';

export interface ConnectServerPayload {
  name?: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'sshKey';
  password?: string;
  privateKey?: string;
  pemFileName?: string;
  passphrase?: string;
  email: string;
  verifyConnection?: boolean;
  scanDirectories?: string[];
}

const PRIVATE_KEY_PATTERN = /-----BEGIN (?:OPENSSH|RSA|DSA|EC|PRIVATE) PRIVATE KEY-----[\s\S]+-----END (?:OPENSSH|RSA|DSA|EC|PRIVATE) PRIVATE KEY-----/;

const normalizePrivateKey = (privateKey?: string) => {
  if (!privateKey) {
    return undefined;
  }

  const normalized = privateKey.replace(/\r\n/g, '\n').trim();
  if (!PRIVATE_KEY_PATTERN.test(normalized)) {
    throw new AppError('Uploaded PEM file is not a supported private key.', HTTP_STATUS.BAD_REQUEST);
  }

  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
};

const sanitizeServer = (server: any) => {
  const doc = typeof server.toObject === 'function' ? server.toObject() : { ...server };
  delete doc.encryptedPassword;
  delete doc.encryptedPrivateKey;
  delete doc.encryptedPassphrase;
  return doc;
};

const enrichWithScanDirectories = async (serverDoc: any) => {
  const serverId = serverDoc._id?.toString() || serverDoc.id;
  if (!serverId) return serverDoc;
  const config = await ServerMaintenanceConfig.findOne({
    server: new Types.ObjectId(serverId),
  }).lean();
  return {
    ...serverDoc,
    scanDirectories: config?.scanDirectories || [],
  };
};

export const serverConnectionService = {
  sanitize: sanitizeServer,

  async connect(payload: ConnectServerPayload, owner?: Types.ObjectId) {
    const privateKey = normalizePrivateKey(payload.privateKey);
    const server = await ServerConnection.create({
      name: payload.name || `${payload.username}@${payload.host}`,
      host: payload.host,
      port: payload.port || 22,
      username: payload.username,
      authType: payload.authType,
      encryptedPassword: secretCrypto.encrypt(payload.password),
      encryptedPrivateKey: secretCrypto.encrypt(privateKey),
      encryptedPassphrase: secretCrypto.encrypt(payload.passphrase),
      email: payload.email,
      owner,
      status: 'pending',
      active: true,
      created: new Date(),
      updated: new Date(),
    });

    const validScanDirectories = (payload.scanDirectories || [])
      .map((dir) => dir.trim())
      .filter((dir) => dir.length > 0)
      .filter((dir) => {
        if (!dir.startsWith('/')) return false;
        if (dir.includes('..')) return false;
        return true;
      });

    await configService.ensureDefault(server._id, {
      scanDirectories: validScanDirectories.length ? validScanDirectories : undefined,
    } as any);

    if (payload.verifyConnection) {
      try {
        await sshService.test(server);
        server.status = 'connected';
        server.lastConnectedAt = new Date();
        server.connectionError = undefined;
      } catch (error) {
        server.status = 'unreachable';
        server.connectionError = error instanceof Error ? error.message : 'Unable to connect over SSH.';
      }
      server.updated = new Date();
      await server.save();
    }

    return enrichWithScanDirectories(sanitizeServer(server));
  },

  async list(owner?: Types.ObjectId) {
    const query: Record<string, unknown> = { active: true };
    if (owner) {
      query.owner = owner;
    }

    const servers = await ServerConnection.find(query).sort({ created: -1 });
    const sanitized = servers.map(sanitizeServer);
    return Promise.all(sanitized.map(enrichWithScanDirectories));
  },

  async getById(serverId: string) {
    const server = await ServerConnection.findOne({ _id: serverId, active: true });
    if (!server) {
      throw new AppError('Server not found.', HTTP_STATUS.NOT_FOUND);
    }

    return server;
  },

  async update(serverId: string, payload: Partial<ConnectServerPayload>) {
    const server = await ServerConnection.findOne({ _id: serverId, active: true });
    if (!server) {
      throw new AppError('Server not found.', HTTP_STATUS.NOT_FOUND);
    }

    if (payload.name !== undefined) server.name = payload.name;
    if (payload.host !== undefined) server.host = payload.host;
    if (payload.port !== undefined) server.port = payload.port;
    if (payload.username !== undefined) server.username = payload.username;
    if (payload.authType !== undefined) server.authType = payload.authType;
    if (payload.email !== undefined) server.email = payload.email;
    if (payload.password !== undefined) server.encryptedPassword = secretCrypto.encrypt(payload.password);
    if (payload.privateKey !== undefined) server.encryptedPrivateKey = secretCrypto.encrypt(normalizePrivateKey(payload.privateKey));
    if (payload.passphrase !== undefined) server.encryptedPassphrase = secretCrypto.encrypt(payload.passphrase);

    // Validate and save scan directories to the maintenance config
    if (payload.scanDirectories !== undefined) {
      const validDirectories = payload.scanDirectories
        .map((dir) => dir.trim())
        .filter((dir) => dir.length > 0)
        .filter((dir) => {
          // Only allow absolute paths and reject path traversal
          if (!dir.startsWith('/')) return false;
          if (dir.includes('..')) return false;
          return true;
        });

      await configService.ensureDefault(server._id, {
        scanDirectories: validDirectories,
      } as any);
    }

    server.updated = new Date();
    await server.save();

    return enrichWithScanDirectories(sanitizeServer(server));
  },

  async remove(serverId: string) {
    const server = await ServerConnection.findOne({ _id: serverId, active: true });
    if (!server) {
      throw new AppError('Server not found.', HTTP_STATUS.NOT_FOUND);
    }

    server.active = false;
    server.updated = new Date();
    await server.save();

    return serverId;
  },

  async bulkRemove(ids: string[]) {
    await ServerConnection.updateMany(
      { _id: { $in: ids } },
      { active: false, updated: new Date() },
    );
    return ids;
  },
};
