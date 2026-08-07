import { Request } from 'express';

/**
 * Check if token info exists in request
 */
export const checkTokenInfo = (req: Request, key?: string): boolean => {
  if (!(req as any).user) return false;
  if (key) return !!(req as any).user[key];
  return true;
};

/**
 * Get token info from request
 */
export const getTokenInfo = (req: Request, key?: string): any => {
  if (!(req as any).user) return null;
  if (key) return (req as any).user[key];
  return (req as any).user;
};

/**
 * Get login type
 */
export const getLoginType = (req: Request): string => {
  const user = (req as any).user;
  if (user && user.role) {
    return typeof user.role === 'object' ? (user.role as any).role : 'USER';
  }
  return 'GUEST';
};

export default {
  checkTokenInfo,
  getTokenInfo,
  getLoginType
};
