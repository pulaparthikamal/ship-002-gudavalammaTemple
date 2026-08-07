import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.util';
import { AppError } from '../utils/error.util';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { t } from '../i18n';
import { JwtPayload } from 'jsonwebtoken';
import { Token } from '../modules/token/token.model';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError(t('auth.token.missing', {}, req.locale), HTTP_STATUS.UNAUTHORIZED));
    }

    const token = authHeader.split(' ')[1];
    verifyAccessToken(token) as JwtPayload;

    const tokenDoc = await Token.findOne({ accessToken: token, active: true }).populate({
      path: 'user',
      populate: { path: 'role' }
    });

    if (!tokenDoc || !tokenDoc.user) {
      return next(new AppError(t('auth.token.invalid', {}, req.locale), HTTP_STATUS.UNAUTHORIZED));
    }

    const user: any = tokenDoc.user;
    if (!user.active) {
      return next(new AppError(t('auth.login.accountInactive', {}, req.locale), HTTP_STATUS.FORBIDDEN));
    }

    req.user = user;
    next();
  } catch (error) {
    next(new AppError(t('auth.token.invalid', {}, req.locale), HTTP_STATUS.UNAUTHORIZED));
  }
};
