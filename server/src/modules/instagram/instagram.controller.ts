import { Request, Response } from 'express';
import axios from 'axios';
import { envConfig } from '../../config/env.config';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { getRequestBaseUrl, getFrontendUrl } from '../../utils/url.util';
import { InstagramToken } from './instagram.model';
import { getPlatformConfig } from '../platform/platformConfig.service';

const graphApiVersion = 'v19.0';
const instagramPageFields = [
  'id',
  'name',
  'access_token',
  'instagram_business_account{id,username,name}',
  'connected_instagram_account{id,username,name}',
].join(',');

const getInstagramConfig = async (req: Request) => {
  const config = await getPlatformConfig('instagram');
  return {
    appId: config?.clientId || envConfig.instagramAppId || envConfig.fbAppId,
    appSecret: config?.clientSecret || envConfig.instagramAppSecret || envConfig.fbAppSecret,
    redirectUri: `${getRequestBaseUrl(req)}/auth/instagram/callback`,
  };
};

const mapPagesToInstagramAccounts = (pages: any[]) =>
  pages
    .map((page: any) => {
      const instagramAccount = page.instagram_business_account || page.connected_instagram_account;

      if (!page.id || !page.name || !page.access_token || !instagramAccount?.id) {
        return null;
      }

      return {
        instagramUserId: instagramAccount.id,
        username: instagramAccount.username || instagramAccount.name || page.name,
        name: instagramAccount.name,
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        isActive: true,
      };
    })
    .filter(Boolean);

export class InstagramController {
  private refreshAccounts = async (igToken: any) => {
    const pagesResponse = await axios.get(`https://graph.facebook.com/${graphApiVersion}/me/accounts`, {
      params: {
        access_token: igToken.userAccessToken,
        fields: 'id,name,access_token',
      },
    });

    const pages = await Promise.all(
      (pagesResponse.data?.data || []).map(async (page: any) => {
        try {
          const pageResponse = await axios.get(`https://graph.facebook.com/${graphApiVersion}/${page.id}`, {
            params: {
              access_token: igToken.userAccessToken,
              fields: instagramPageFields,
            },
          });

          return {
            ...page,
            ...pageResponse.data,
            access_token: page.access_token || pageResponse.data?.access_token,
          };
        } catch (error: any) {
          console.error('Instagram page lookup failed:', {
            pageId: page.id,
            pageName: page.name,
            error: error.response?.data?.error?.message || error.message,
          });
          return page;
        }
      })
    );
    const accounts = mapPagesToInstagramAccounts(pages);

    console.log('Instagram account refresh:', {
      pagesChecked: pages.length,
      accountsFound: accounts.length,
      pagesWithInstagram: pages.filter((page: any) => page.instagram_business_account?.id || page.connected_instagram_account?.id).length,
    });

    igToken.accounts = accounts;
    await igToken.save();

    return accounts;
  };

  login = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.query;
    const { appId, redirectUri } = await getInstagramConfig(req);

    if (!appId || !redirectUri) {
      return res.status(500).json({ message: 'Instagram app configuration is missing' });
    }

    const scopes = [
      'public_profile',
      'email',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
    ].join(',');

    const state = userId ? String(userId) : 'unknown';
    const loginUrl = `https://www.facebook.com/${graphApiVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&auth_type=rerequest`;

    res.redirect(loginUrl);
  });

  callback = asyncHandler(async (req: Request, res: Response) => {
    const { code, state: userId } = req.query;
    const { appId, appSecret, redirectUri } = await getInstagramConfig(req);

    if (!code) {
      return res.status(400).json({ message: 'No code provided' });
    }

    if (!appId || !appSecret || !redirectUri) {
      return res.status(500).json({ message: 'Instagram app configuration is missing' });
    }

    try {
      const tokenResponse = await axios.get(`https://graph.facebook.com/${graphApiVersion}/oauth/access_token`, {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
      });

      const longLivedTokenResponse = await axios.get(`https://graph.facebook.com/${graphApiVersion}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: tokenResponse.data.access_token,
        },
      });

      const longLivedUserToken = longLivedTokenResponse.data.access_token;

      const pagesResponse = await axios.get(`https://graph.facebook.com/${graphApiVersion}/me/accounts`, {
        params: {
          access_token: longLivedUserToken,
          fields: 'id,name,access_token',
        },
      });

      const permissionsResponse = await axios.get(`https://graph.facebook.com/${graphApiVersion}/me/permissions`, {
        params: {
          access_token: longLivedUserToken,
        },
      });

      console.log('Instagram OAuth granted permissions:', (permissionsResponse.data?.data || []).filter((item: any) => item.status === 'granted').map((item: any) => item.permission));

      const pages = await Promise.all(
        (pagesResponse.data?.data || []).map(async (page: any) => {
          try {
            const pageResponse = await axios.get(`https://graph.facebook.com/${graphApiVersion}/${page.id}`, {
              params: {
                access_token: longLivedUserToken,
                fields: instagramPageFields,
              },
            });

            return {
              ...page,
              ...pageResponse.data,
              access_token: page.access_token || pageResponse.data?.access_token,
            };
          } catch (error: any) {
            console.error('Instagram page lookup failed:', {
              pageId: page.id,
              pageName: page.name,
              error: error.response?.data?.error?.message || error.message,
            });
            return page;
          }
        })
      );
      const accounts = mapPagesToInstagramAccounts(pages);

      console.log('Instagram OAuth account discovery:', {
        userId,
        pagesChecked: pages.length,
        accountsFound: accounts.length,
        pagesWithInstagram: pages.filter((page: any) => page.instagram_business_account?.id || page.connected_instagram_account?.id).length,
      });

      if (userId && userId !== 'unknown') {
        await InstagramToken.findOneAndUpdate(
          { user: userId },
          {
            userAccessToken: longLivedUserToken,
            accounts,
            updated: new Date(),
          },
          { upsert: true, new: true }
        );
      }

      const frontendUrl = getFrontendUrl(req);
      res.redirect(`${frontendUrl}/socialMedia/success?platform=instagram`);
    } catch (error: any) {
      console.error('Instagram OAuth Error:', error.response?.data || error.message);
      res.status(500).json({
        message: 'Instagram authentication failed',
        error: error.response?.data || error.message,
      });
    }
  });

  getAccounts = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    try {
      const igToken = await InstagramToken.findOne({ user: userId });
      if (!igToken) {
        return res.status(404).json({ message: 'No Instagram connection found for this user', data: [] });
      }

      const accounts = igToken.accounts.length ? igToken.accounts : await this.refreshAccounts(igToken);
      res.json({ success: true, data: accounts });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch Instagram accounts', error: error.message });
    }
  });
}

export const instagramController = new InstagramController();
