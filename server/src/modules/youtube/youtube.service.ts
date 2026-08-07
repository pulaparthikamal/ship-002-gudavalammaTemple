import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.util';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { envConfig } from '../../config/env.config';
import { YouTubeToken, IYouTubePostLog } from './youtube.model';
import { ObjectIdType } from '../../types/common.types';
import axios from 'axios';
import { getPlatformConfig } from '../platform/platformConfig.service';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export class YouTubeService {
  private static async getOAuth2Client(redirectUri?: string) {
    const config = await getPlatformConfig('youtube');
    return new google.auth.OAuth2(
      config?.clientId || envConfig.googleClientId,
      config?.clientSecret || envConfig.googleClientSecret,
      redirectUri || config?.redirectUri || envConfig.googleRedirectUri
    );
  }

  static async getAuthUrl(userId: string, redirectUri: string) {
    const oauth2Client = await this.getOAuth2Client(redirectUri);
    return oauth2Client.generateAuthUrl({
      access_type: 'offline', // crucial for getting a refresh token
      scope: SCOPES,
      state: userId,
      prompt: 'consent select_account', // force consent and account selection
    });
  }

  static async handleCallback(code: string, userId: string, redirectUri: string) {
    const oauth2Client = await this.getOAuth2Client(redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get channel info
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelResponse = await youtube.channels.list({
      part: ['snippet', 'id'],
      mine: true,
    });

    const channel = channelResponse.data.items?.[0];
    if (!channel) {
      throw new AppError('No YouTube channel found for this account.', HTTP_STATUS.BAD_REQUEST);
    }

    const { id: channelId, snippet } = channel;
    const name = snippet?.title || 'YouTube Channel';
    const picture = snippet?.thumbnails?.default?.url || '';

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

    // Upsert token
    const updateData: any = {
      user: userId,
      accessToken: tokens.access_token,
      channelId,
      name,
      picture,
      expiresAt,
    };

    if (tokens.refresh_token) {
      updateData.refreshToken = tokens.refresh_token;
    }

    await YouTubeToken.findOneAndUpdate(
      { user: userId },
      updateData,
      { upsert: true, new: true }
    );

    return { channelId, name };
  }

  static async getAuthorizedClient(userId: string) {
    const tokenDoc = await YouTubeToken.findOne({ user: userId });
    if (!tokenDoc) {
      throw new AppError('YouTube account not connected.', HTTP_STATUS.UNAUTHORIZED);
    }

    const oauth2Client = await this.getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenDoc.accessToken,
      refresh_token: tokenDoc.refreshToken,
      expiry_date: tokenDoc.expiresAt?.getTime(),
    });

    // Handle token refresh if expired
    oauth2Client.on('tokens', async (tokens) => {
      const updateData: any = {
        accessToken: tokens.access_token,
        updated: new Date(),
      };
      if (tokens.expiry_date) updateData.expiresAt = new Date(tokens.expiry_date);
      if (tokens.refresh_token) updateData.refreshToken = tokens.refresh_token;

      await YouTubeToken.updateOne({ user: userId }, updateData);
      logger.info(`[YouTube] Tokens refreshed and updated in DB for user ${userId}`);
    });

    return oauth2Client;
  }

  static async uploadVideo(options: {
    userId: string;
    title: string;
    description: string;
    videoUrl: string;
    tags?: string[];
    postId?: string;
  }) {
    const { userId, title, description, videoUrl, tags, postId } = options;
    const auth = await this.getAuthorizedClient(userId);
    const youtube = google.youtube({ version: 'v3', auth });

    const localPath = this.resolveLocalVideoPath(videoUrl);
    if (!localPath || !fs.existsSync(localPath)) {
      throw new AppError('Video file not found on server.', HTTP_STATUS.BAD_REQUEST);
    }

    const logEntry: Partial<IYouTubePostLog> = {
      postId,
      platform: 'youtube',
      requestPayload: { title, description, tags, videoUrl },
      timestamp: new Date(),
    };

    try {
      logger.info(`[YouTube] Starting video upload for user ${userId}: ${title}`);
      
      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            tags,
          },
          status: {
            privacyStatus: 'public', // Default to public
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(localPath),
        },
      });

      const videoId = response.data.id || '';
      logEntry.status = 'success';
      logEntry.youtubeVideoId = videoId;
      logEntry.responsePayload = response.data as any;

      logger.info(`[YouTube] Video uploaded successfully. ID: ${videoId}`);
      
      await this.savePostLog(userId, logEntry as IYouTubePostLog);
      return { success: true, videoId };
    } catch (error: any) {
      const errMsg = error.message || 'YouTube upload failed';
      logger.error(`[YouTube] Upload failed: ${errMsg}`);
      
      logEntry.status = 'failed';
      logEntry.errorMessage = errMsg;
      logEntry.responsePayload = error.response?.data || {};
      
      await this.savePostLog(userId, logEntry as IYouTubePostLog);
      throw new AppError(errMsg, error.response?.status || HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  private static resolveLocalVideoPath(videoUrl: string): string | null {
    if (!videoUrl) return null;
    
    // Pattern from linkedin.service.ts
    const normalizedUrl = videoUrl.replace(/\\/g, '/');
    
    // Check Agentic media
    if (normalizedUrl.includes('/social_media_posts/')) {
        const marker = '/social_media_posts/';
        const idx = normalizedUrl.indexOf(marker);
        const rel = normalizedUrl.slice(idx + 1);
        const possibleRoots = [
            path.resolve(process.cwd(), '../AgenticServer/media'),
            path.resolve(process.cwd(), 'AgenticServer/media'),
            path.resolve(process.cwd(), '..', 'AgenticServer', 'media')
        ];
        for (const root of possibleRoots) {
            const fullPath = path.resolve(root, rel);
            if (fs.existsSync(fullPath)) return fullPath;
        }
    }

    // Check normal uploads
    const uploadsSearchStr = 'uploads/';
    const uploadsIndex = normalizedUrl.toLowerCase().indexOf(uploadsSearchStr);
    if (uploadsIndex !== -1) {
        const relativeUploadPath = decodeURIComponent(normalizedUrl.slice(uploadsIndex + uploadsSearchStr.length));
        const uploadRoot = path.resolve(process.cwd(), envConfig.uploadRootDir);
        const absolutePath = path.resolve(uploadRoot, relativeUploadPath);
        if (fs.existsSync(absolutePath)) return absolutePath;
        
        const fallbackRoot = path.resolve(process.cwd(), 'server', envConfig.uploadRootDir);
        const fallbackPath = path.resolve(fallbackRoot, relativeUploadPath);
        if (fs.existsSync(fallbackPath)) return fallbackPath;
    }

    return null;
  }

  private static async savePostLog(userId: string, log: IYouTubePostLog) {
    try {
      await YouTubeToken.updateOne(
        { user: userId },
        { $push: { postLogs: log } }
      );
    } catch (err: any) {
      logger.warn(`[YouTube] Failed to save post log: ${err.message}`);
    }
  }

  static async disconnect(userId: string) {
    await YouTubeToken.findOneAndDelete({ user: userId });
  }

  static async getTokenForUser(userId: string) {
    return YouTubeToken.findOne({ user: userId });
  }
}
