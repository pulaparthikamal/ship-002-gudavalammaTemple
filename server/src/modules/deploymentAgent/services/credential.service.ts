import { Types } from 'mongoose';
import { Credential, ICredential } from '../models/credential.model';
import { deploymentCrypto } from '../utils/crypto.util';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

export interface CreateCredentialPayload {
  name: string;
  type: 'sshKey' | 'httpsToken' | 'password';
  value: string;
  passphrase?: string;
  description?: string;
}

const sanitize = (doc: ICredential) => {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete (obj as any).encryptedValue;
  delete (obj as any).encryptedPassphrase;
  return obj;
};

export const credentialService = {
  async create(payload: CreateCredentialPayload, owner?: Types.ObjectId) {
    const credential = await Credential.create({
      name: payload.name,
      type: payload.type,
      encryptedValue: deploymentCrypto.encrypt(payload.value),
      encryptedPassphrase: deploymentCrypto.encrypt(payload.passphrase),
      description: payload.description,
      owner,
      active: true,
      created: new Date(),
      updated: new Date(),
    });
    return sanitize(credential);
  },

  async list(owner?: Types.ObjectId) {
    const query: Record<string, unknown> = { active: true };
    if (owner) query.owner = owner;
    const credentials = await Credential.find(query).sort({ created: -1 });
    return credentials.map(sanitize);
  },

  async getById(id: string, owner?: Types.ObjectId) {
    const query: Record<string, unknown> = { _id: id, active: true };
    if (owner) query.owner = owner;
    const credential = await Credential.findOne(query);
    if (!credential) {
      throw new AppError('Credential not found.', HTTP_STATUS.NOT_FOUND);
    }
    return credential;
  },

  async getDecrypted(id: string) {
    const credential = await Credential.findOne({ _id: id, active: true });
    if (!credential) {
      throw new AppError('Credential not found.', HTTP_STATUS.NOT_FOUND);
    }
    return {
      type: credential.type,
      value: deploymentCrypto.decrypt(credential.encryptedValue),
      passphrase: deploymentCrypto.decrypt(credential.encryptedPassphrase),
    };
  },

  async update(id: string, payload: Partial<CreateCredentialPayload>, owner?: Types.ObjectId) {
    const query: Record<string, unknown> = { _id: id, active: true };
    if (owner) query.owner = owner;
    const credential = await Credential.findOne(query);
    if (!credential) {
      throw new AppError('Credential not found.', HTTP_STATUS.NOT_FOUND);
    }
    if (payload.name !== undefined) credential.name = payload.name;
    if (payload.description !== undefined) credential.description = payload.description;
    if (payload.value !== undefined) credential.encryptedValue = deploymentCrypto.encrypt(payload.value)!;
    if (payload.passphrase !== undefined) credential.encryptedPassphrase = deploymentCrypto.encrypt(payload.passphrase);
    credential.updated = new Date();
    await credential.save();
    return sanitize(credential);
  },

  async remove(id: string, owner?: Types.ObjectId) {
    const query: Record<string, unknown> = { _id: id, active: true };
    if (owner) query.owner = owner;
    const credential = await Credential.findOne(query);
    if (!credential) {
      throw new AppError('Credential not found.', HTTP_STATUS.NOT_FOUND);
    }
    credential.active = false;
    credential.updated = new Date();
    await credential.save();
    return id;
  },
};
