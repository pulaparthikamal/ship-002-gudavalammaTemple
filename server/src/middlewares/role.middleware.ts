import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error.util';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { t } from '../i18n';
import { RoleEnum } from '../constants/roles.constants';

export const roleGuard = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.role) {
      return next(new AppError(t('common.forbidden', {}, req.locale), HTTP_STATUS.FORBIDDEN));
    }

    const userRole = typeof user.role === 'object' ? (user.role as any).role : user.role;

    if (!allowedRoles.includes(userRole)) {
      return next(new AppError(t('common.forbidden', {}, req.locale), HTTP_STATUS.FORBIDDEN));
    }

    next();
  };
};

export const permissionGuard = (module: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.role) {
      return next(new AppError(t('common.forbidden', {}, req.locale), HTTP_STATUS.FORBIDDEN));
    }

    const role = typeof user.role === 'object' ? user.role : null;
    if (!role) {
      return next(new AppError(t('common.forbidden', {}, req.locale), HTTP_STATUS.FORBIDDEN));
    }

    // SUPER_ADMIN has full access
    if ((role as any).role === RoleEnum.SUPER_ADMIN) {
      return next();
    }

    const permissions = (role as any).permissions;
    if (!permissions) {
      return next(new AppError(t('common.forbidden', {}, req.locale), HTTP_STATUS.FORBIDDEN));
    }

    // Try exact match first
    let modulePermissions = typeof permissions.get === 'function'
      ? permissions.get(module)
      : (permissions as any)[module];

    // If not found, try case-insensitive match
    if (!modulePermissions) {
      const keys = typeof permissions.keys === 'function' ? Array.from(permissions.keys()) : Object.keys(permissions);
      const matchedKey = keys.find(k => (k as string).toLowerCase() === module.toLowerCase());
      if (matchedKey) {
        modulePermissions = typeof permissions.get === 'function'
          ? permissions.get(matchedKey as string)
          : (permissions as any)[matchedKey as string];
      }
    }

    if (!modulePermissions || !modulePermissions.actions.includes(action)) {
      return next(new AppError(t('common.forbidden', {}, req.locale), HTTP_STATUS.FORBIDDEN));
    }

    next();
  };
};
