import crypto from 'crypto';
import { envConfig } from '../../../config/env.config';

const algorithm = 'aes-256-gcm';
const key = crypto
  .createHash('sha256')
  .update(process.env.DEPLOYMENT_SECRET || envConfig.jwtAccessSecret || 'deployment-agent-secret')
  .digest();

export const deploymentCrypto = {
  encrypt(value?: string): string | undefined {
    if (!value) return undefined;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  },

  decrypt(value?: string): string | undefined {
    if (!value) return undefined;

    const [ivHex, tagHex, encryptedHex] = value.split(':');
    if (!ivHex || !tagHex || !encryptedHex) return undefined;

    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  },
};
