import crypto from 'crypto';

/**
 * Legacy Hashing Utility using PBKDF2-SHA1
 * Matches the pattern provided for model-level authentication
 */

export const hashPassword = (password: string, salt: string): string => {
  if (salt && password) {
    return crypto
      .pbkdf2Sync(
        password,
        Buffer.from(salt, 'base64'),
        10000,
        64,
        'SHA1'
      )
      .toString('base64');
  }
  return password;
};

export const comparePassword = (password: string, hash: string, salt: string): boolean => {
  const newHash = hashPassword(password, salt);
  return newHash === hash;
};

export const generateSalt = (): string => {
  return crypto.randomBytes(16).toString('base64');
};
