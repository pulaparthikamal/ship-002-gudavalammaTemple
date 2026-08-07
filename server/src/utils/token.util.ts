import jwt, { JwtPayload } from 'jsonwebtoken';
import { envConfig } from '../config/env.config';

export const signAccessToken = (payload: object, expiresIn?: string): string => {
  const finalExpiresIn = (expiresIn && String(expiresIn).trim()) || envConfig.jwtAccessExpiresIn;
  return jwt.sign(payload, envConfig.jwtAccessSecret, {
    expiresIn: finalExpiresIn as any,
  });
};

export const signRefreshToken = (payload: object): string => {
  return jwt.sign(payload, envConfig.jwtRefreshSecret, {
    expiresIn: envConfig.jwtRefreshExpiresIn as any,
  });
};

export const verifyAccessToken = (token: string): JwtPayload | string => {
  return jwt.verify(token, envConfig.jwtAccessSecret);
};

export const verifyRefreshToken = (token: string): JwtPayload | string => {
  return jwt.verify(token, envConfig.jwtRefreshSecret);
};
