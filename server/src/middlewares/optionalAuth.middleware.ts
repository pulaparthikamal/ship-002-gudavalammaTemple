import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.util';
import { Token } from '../modules/token/token.model';

/**
 * Same JWT/Token lookup as authMiddleware, but never rejects the request —
 * populates req.user when a valid, active-user token is present, otherwise
 * leaves it undefined and lets the route proceed as a guest. Used only on
 * the booking-creation endpoints that support guest checkout; list/cancel/
 * receipt endpoints still require a real session via authMiddleware.
 */
export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    verifyAccessToken(token);

    const tokenDoc = await Token.findOne({ accessToken: token, active: true }).populate({
      path: 'user',
      populate: { path: 'role' },
    });

    const user: any = tokenDoc?.user;
    if (user?.active) {
      req.user = user;
    }

    next();
  } catch {
    // Invalid/expired token — proceed as a guest rather than rejecting.
    next();
  }
};
