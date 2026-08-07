import { Request, Response } from 'express';
import originalAxios from 'axios';
import { envConfig } from '../../config/env.config';
import http from 'http';
import https from 'https';

const axios = originalAxios.create({
  httpAgent: new http.Agent({ family: 4 }),
  httpsAgent: new https.Agent({ family: 4 }),
});
import { LinkedInToken } from './linkedin.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { logger } from '../../utils/logger.util';
import { getRequestBaseUrl, getFrontendUrl } from '../../utils/url.util';
import { getPlatformConfig } from '../platform/platformConfig.service';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

const SCOPES = ['openid', 'profile', 'w_member_social'].join(' ');

export class LinkedInController {
  /**
   * Step 1 — Redirect the user to LinkedIn's OAuth consent screen.
   * Query param: userId (MongoDB _id of the logged-in user)
   */
  static async login(req: Request, res: Response) {
    const { userId } = req.query;

    if (!userId) {
      throw new AppError('userId query parameter is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const config = await getPlatformConfig('linkedin');
    const redirectUri = `${getRequestBaseUrl(req)}/auth/linkedin/callback`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: String(config?.clientId || envConfig.linkedInClientId || ''),
      redirect_uri: redirectUri,
      state: String(userId),
      scope: SCOPES,
    });

    logger.info(`[LinkedIn OAuth] Redirecting user ${userId} to LinkedIn consent screen`);
    return res.redirect(`${LINKEDIN_AUTH_URL}?${params.toString()}`);
  }

  /**
   * Step 2 — LinkedIn redirects here with ?code=...&state=<userId>
   * Exchange code for access token, fetch profile URN, persist to DB.
   */
  static async callback(req: Request, res: Response) {
    const { code, state: userId, error, error_description } = req.query;

    if (error) {
      logger.error(`[LinkedIn OAuth] Error from LinkedIn: ${error} — ${error_description}`);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: 'LinkedIn authentication failed.',
        error: { error, error_description },
      });
    }

    if (!code || !userId) {
      throw new AppError('Missing code or state (userId) from LinkedIn callback.', HTTP_STATUS.BAD_REQUEST);
    }

    // Exchange authorization code for access token
    const config = await getPlatformConfig('linkedin');
    const redirectUri = `${getRequestBaseUrl(req)}/auth/linkedin/callback`;
    const tokenResponse = await axios.post(
      LINKEDIN_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
        client_id: String(config?.clientId || envConfig.linkedInClientId || ''),
        client_secret: String(config?.clientSecret || envConfig.linkedInClientSecret || ''),
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // Fetch the user's LinkedIn person URN
    const profileResponse = await axios.get(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const sub: string = profileResponse.data?.sub;
    if (!sub) {
      throw new AppError('Failed to retrieve LinkedIn profile ID.', HTTP_STATUS.BAD_REQUEST);
    }
    
    const name: string = profileResponse.data?.name || `${profileResponse.data?.given_name || ''} ${profileResponse.data?.family_name || ''}`.trim() || 'LinkedIn User';
    const picture: string = profileResponse.data?.picture || '';

    const personId = `urn:li:person:${sub}`;
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;

    // Upsert token — one record per user
    await LinkedInToken.findOneAndUpdate(
      { user: userId },
      { user: userId, accessToken: access_token, personId, name, picture, expiresAt },
      { upsert: true, new: true }
    );

    logger.info(`[LinkedIn OAuth] Token saved for user ${userId} (${personId})`);

    const frontendUrl = getFrontendUrl(req);
    return res.redirect(`${frontendUrl}/socialMedia/success?platform=linkedin`);
  }

  /**
   * Check if the user is connected to LinkedIn.
   */
  static async getStatus(req: Request, res: Response) {
    const { userId } = req.query;
    if (!userId) {
      throw new AppError('userId query parameter is required.', HTTP_STATUS.BAD_REQUEST);
    }
    
    // Using inline import/require or importing the service at the top
    const { getLinkedInTokenForUser } = require('./linkedin.service');
    const token = await getLinkedInTokenForUser(userId as string);
    
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: token ? [token] : [], // Array to match fb/ig frontend logic check
    });
  }

  /**
   * Disconnect the user from LinkedIn (delete their token).
   */
  static async disconnect(req: Request, res: Response) {
    const { userId } = req.query;
    if (!userId) {
      throw new AppError('userId query parameter is required.', HTTP_STATUS.BAD_REQUEST);
    }

    await LinkedInToken.findOneAndDelete({ user: userId });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'LinkedIn account disconnected successfully',
    });
  }
}
