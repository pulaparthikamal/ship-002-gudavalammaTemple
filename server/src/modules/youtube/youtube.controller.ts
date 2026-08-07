import { Request, Response } from 'express';
import { YouTubeService } from './youtube.service';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { logger } from '../../utils/logger.util';
import { AppError } from '../../utils/error.util';
import { envConfig } from '../../config/env.config';
import { getRequestBaseUrl, getFrontendUrl } from '../../utils/url.util';

export class YouTubeController {
  /**
   * Step 1 - Redirect user to Google OAuth consent screen
   */
  static async login(req: Request, res: Response) {
    const { userId } = req.query;
    if (!userId) {
      throw new AppError('userId query parameter is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const redirectUri = `${getRequestBaseUrl(req)}/auth/youtube/callback`;
    const authUrl = await YouTubeService.getAuthUrl(String(userId), redirectUri);
    logger.info(`[YouTube OAuth] Redirecting user ${userId} to Google using redirect: ${redirectUri}`);
    return res.redirect(authUrl);
  }

  /**
   * Step 2 - Google callback handler
   */
  static async callback(req: Request, res: Response) {
    const { code, state: userId, error } = req.query;

    if (error) {
      logger.error(`[YouTube OAuth] Error from Google: ${error}`);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: 'YouTube authentication failed.',
        error,
      });
    }

    if (!code || !userId) {
      throw new AppError('Missing code or state (userId) from Google callback.', HTTP_STATUS.BAD_REQUEST);
    }

    try {
      const redirectUri = `${getRequestBaseUrl(req)}/auth/youtube/callback`;
      await YouTubeService.handleCallback(String(code), String(userId), redirectUri);
      logger.info(`[YouTube OAuth] Connection successful for user ${userId}`);

      const frontendUrl = getFrontendUrl(req);
      return res.redirect(`${frontendUrl}/socialMedia/success?platform=youtube`);
    } catch (err: any) {
      logger.error(`[YouTube OAuth] Callback failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get connection status
   */
  static async getStatus(req: Request, res: Response) {
    const { userId } = req.query;
    if (!userId) {
      throw new AppError('userId query parameter is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const token = await YouTubeService.getTokenForUser(String(userId));
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: token ? [token] : [], // Array to match frontend expectations
    });
  }

  /**
   * Disconnect account
   */
  static async disconnect(req: Request, res: Response) {
    const { userId } = req.query;
    if (!userId) {
      throw new AppError('userId query parameter is required.', HTTP_STATUS.BAD_REQUEST);
    }

    await YouTubeService.disconnect(String(userId));
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'YouTube account disconnected successfully',
    });
  }
}
