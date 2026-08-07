import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authService } from './auth.service';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';

export const authController = {
  async register(req: Request, res: Response) {
    const user = await authService.register(req.body, req.locale || 'en');
    req.entityType = 'user';
    req.user = user;
    
    await serviceUtil.addActivity(req, 'Auth', 'Register', `User registered: ${user.email}`, 'userCreate');
    
    return res.json(respUtil.createSuccessResponse(req));
  },

  async login(req: Request, res: Response) {
    const { user, accessToken, refreshToken } = await authService.login(req.body, req.locale || 'en');
    req.entityType = 'user';
    req.user = user;
    req.token = { accessToken, refreshToken };
    req.i18nKey = 'auth.login.success';
    
    await serviceUtil.addActivity(req, 'Auth', 'Login', `${user.firstName} ${user.lastName} logged in successfully`, 'loginSuccess');
    
    return res.json(respUtil.loginSuccessResponse(req));
  },

  async refreshToken(req: Request, res: Response) {
    const { refreshToken } = req.body;
    const data = await authService.refreshToken(refreshToken, req.locale || 'en');
    
    let expiresAt: number | null = null;
    try {
      const decoded = jwt.decode(data.accessToken) as { exp?: number } | string | null;
      if (decoded && typeof decoded !== 'string' && decoded.exp) {
        expiresAt = decoded.exp * 1000;
      }
    } catch (err) {
      // ignore
    }

    return res.json({
      success: true,
      statusCode: HTTP_STATUS.OK,
      accessToken: data.accessToken,
      expiresAt,
    });
  },

  async logout(req: Request, res: Response) {
    const accessToken = req.headers.authorization!.split(' ')[1];
    await serviceUtil.addActivity(req, 'Auth', 'Logout', `User logged out`, 'logoutSuccess');
    await authService.logout(accessToken);
    req.i18nKey = 'auth.token.loggedOut';
    return res.json(respUtil.logoutSuccessResponse(req));
  },

  async changePassword(req: Request, res: Response) {
    await authService.changePassword((req as any).user._id, req.body, req.locale || 'en');
    await serviceUtil.addActivity(req, 'Auth', 'ChangePassword', `User changed password`, 'passwordChange');
    req.i18nKey = 'auth.password.changeSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async getMe(req: Request, res: Response) {
    const user = await authService.getMe((req as any).user._id, req.locale || 'en');
    req.entityType = 'user';
    req.user = user;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },
};
