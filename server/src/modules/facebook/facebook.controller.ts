import { Request, Response } from 'express';
import axios from 'axios';
import { envConfig } from '../../config/env.config';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { getRequestBaseUrl, getFrontendUrl } from '../../utils/url.util';
import { FacebookToken } from './facebook.model';
import * as socialAccountService from '../social-accounts/socialAccount.service';
import { getPlatformConfig } from '../platform/platformConfig.service';

export class FacebookController {
  private refreshPages = async (fbToken: any) => {
    const pagesResponse = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: fbToken.userAccessToken,
        fields: 'id,name,access_token',
      },
    });

    const pages = (pagesResponse.data?.data || [])
      .filter((page: any) => page.id && page.name && page.access_token)
      .map((page: any) => ({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        isActive: true
      }));

    fbToken.pages = pages;
    await fbToken.save();

    return pages;
  };

  /**
   * Redirect to Facebook OAuth dialog
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.query;

    const scopes = [
      'public_profile',
      'email',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts'
    ].join(',');

    // Using state to pass userId through the OAuth flow
    const state = userId ? String(userId) : 'unknown';

    const config = await getPlatformConfig('facebook');
    const appId = config?.clientId || envConfig.fbAppId;

    if (!appId) {
      return res.status(500).json({ message: 'Facebook app ID is missing' });
    }

    const redirectUri = `${getRequestBaseUrl(req)}/auth/facebook/callback`;
    const fbLoginUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}`;

    console.log('Redirecting to Facebook Login:', fbLoginUrl);
    res.redirect(fbLoginUrl);
  });

  /**
   * Handle Facebook OAuth callback
   */
  callback = asyncHandler(async (req: Request, res: Response) => {
    const { code, state: userId } = req.query;

    if (!code) {
      console.error('Facebook Auth Error: No code provided');
      return res.status(400).json({ message: 'No code provided' });
    }

    try {
      // 1. Exchange short-lived code for user access token
      const config = await getPlatformConfig('facebook');
      const appId = config?.clientId || envConfig.fbAppId;
      const appSecret = config?.clientSecret || envConfig.fbAppSecret;

      const redirectUri = `${getRequestBaseUrl(req)}/auth/facebook/callback`;
      const tokenResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
      });

      const shortLivedToken = tokenResponse.data.access_token;

      // 2. Exchange for long-lived user token (valid for ~60 days)
      const longLivedTokenResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: envConfig.fbAppId,
          client_secret: envConfig.fbAppSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      const longLivedUserToken = longLivedTokenResponse.data.access_token;
      console.log('Long-lived user token obtained');

      // 3. Fetch pages and page access tokens
      const pagesResponse = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
        params: {
          access_token: longLivedUserToken,
        },
      });

      const pagesData = pagesResponse.data.data; // Array of pages
      console.log(`Fetched ${pagesData.length} pages`);

      const pages = pagesData.map((page: any) => ({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        isActive: true
      }));

      // 4. Store in Database
      if (userId && userId !== 'unknown') {
        const storedToken = await FacebookToken.findOneAndUpdate(
          { user: userId },
          {
            userAccessToken: longLivedUserToken,
            pages,
            updated: new Date()
          },
          { upsert: true, new: true }
        );

        console.log('--- DATABASE STORAGE SUCCESS ---');
        console.log('User ID:', userId);
        console.log('Long-lived Token (first 10 chars):', longLivedUserToken.substring(0, 10) + '...');
        
        // Automatically set the first page as the primary automation account if none exists
        if (pages.length > 0) {
          try {
            await socialAccountService.connectAccount({
              userId: userId as any,
              platform: 'facebook',
              platformAccountId: pages[0].pageId,
              platformAccountName: pages[0].pageName,
              accessToken: pages[0].pageAccessToken,
              status: 'connected'
            });
            console.log(`Auto-linked page "${pages[0].pageName}" for automation`);
          } catch (autoLinkError: any) {
            console.error('Failed to auto-link page:', autoLinkError.message);
          }
        }

        console.log('Pages Stored:', JSON.stringify(storedToken.pages.map(p => ({
          name: p.pageName,
          id: p.pageId,
          tokenPreview: p.pageAccessToken.substring(0, 10) + '...'
        })), null, 2));
        console.log('---------------------------------');
      } else {
        console.warn('No userId provided in state, tokens not stored in DB');
      }

      // 5. Redirect back to frontend
      const frontendUrl = getFrontendUrl(req);
      res.redirect(`${frontendUrl}/socialMedia/success?platform=facebook`);
    } catch (error: any) {
      console.error('Facebook OAuth Error:', error.response?.data || error.message);
      res.status(500).json({
        message: 'Facebook authentication failed',
        error: error.response?.data || error.message
      });
    }
  });

  /**
   * Helper to manually post to a page
   */
  postToPage = asyncHandler(async (req: Request, res: Response) => {
    const { userId, pageId, message } = req.body;

    if (!userId || !pageId || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
      const fbToken = await FacebookToken.findOne({ user: userId });
      if (!fbToken) return res.status(404).json({ message: 'Facebook account not connected' });

      const page = fbToken.pages.find(p => p.pageId === pageId);
      if (!page) return res.status(404).json({ message: 'Page not found for this user' });

      const response = await axios.post(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
        message,
        access_token: page.pageAccessToken
      });

      res.json({ message: 'Posted successfully', data: response.data });
    } catch (error: any) {
      console.error('Facebook Post Error:', error.response?.data || error.message);
      res.status(500).json({ message: 'Failed to post', error: error.response?.data || error.message });
    }
  });

  /**
   * Set a specific page as the active one for automation and posting
   */
  setActivePage = asyncHandler(async (req: Request, res: Response) => {
    const { userId, pageId } = req.body;

    if (!userId || !pageId) {
      return res.status(400).json({ message: 'userId and pageId are required' });
    }

    try {
      const fbToken = await FacebookToken.findOne({ user: userId });
      if (!fbToken) return res.status(404).json({ message: 'Facebook connection not found' });

      // Update FacebookToken pages
      fbToken.pages = fbToken.pages.map(p => ({
        ...p,
        isActive: p.pageId === pageId
      }));
      await fbToken.save();

      // Find the selected page to sync with SocialAccount
      const selectedPage = fbToken.pages.find(p => p.pageId === pageId);
      if (selectedPage) {
        await socialAccountService.connectAccount({
          userId: userId as any,
          platform: 'facebook',
          platformAccountId: selectedPage.pageId,
          platformAccountName: selectedPage.pageName,
          accessToken: selectedPage.pageAccessToken,
          status: 'connected'
        });
      }

      res.json({ success: true, message: `Page "${selectedPage?.pageName}" set as active` });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to set active page', error: error.message });
    }
  });

  /**
   * Get stored pages for a user
   */
  getPages = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    try {
      const fbToken = await FacebookToken.findOne({ user: userId });
      if (!fbToken) {
        return res.status(404).json({ message: 'No Facebook connection found for this user', data: [] });
      }

      const pages = fbToken.pages.length ? fbToken.pages : await this.refreshPages(fbToken);

      res.json({ success: true, data: pages });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch pages', error: error.message });
    }
  });
}

export const facebookController = new FacebookController();
