import crypto from 'crypto';
import { envConfig } from '../config/env.config';

// The key must be 32 bytes for aes-256-cbc. 
// We'll use a hash of the JWT secret as a fallback, but a dedicated key is better.
const ENCRYPTION_KEY = crypto.createHash('sha256').update(envConfig.jwtAccessSecret || 'fallback-secret').digest();
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypt a plain text string
 */
export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

/**
 * Decrypt an encrypted string
 */
export const decrypt = (text: string): string => {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.error('Decryption failed:', e);
    return text; // Return original if decryption fails (might be unencrypted legacy data)
  }
};

/**
 * Mask a secret string (e.g., "sk-....abcd")
 */
export const maskSecret = (secret: string): string => {
  if (!secret || secret.length < 8) return '********';
  return secret.substring(0, 4) + '....' + secret.substring(secret.length - 4);
};
