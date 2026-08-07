import originalAxios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import http from 'http';
import https from 'https';

const axios = originalAxios.create({
  httpAgent: new http.Agent({ family: 4 }),
  httpsAgent: new https.Agent({ family: 4 }),
});
import { logger } from '../../utils/logger.util';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { envConfig } from '../../config/env.config';
import { appConfig } from '../../config/app.config';
import { LinkedInToken, ILinkedInPostLog } from './linkedin.model';
import { ObjectIdType } from '../../types/common.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkedInPostOptions {
  /** 'text' | 'image' | 'multi-image' | 'video' */
  type: 'text' | 'image' | 'multi-image' | 'video';
  text: string;
  mediaUrl?: string;      // single image or video
  mediaUrls?: string[];   // multiple images for carousel
  account: {
    accessToken: string;
    personId: string;    // e.g. "urn:li:person:XXXXXXXXX"
  };
  postId?: string;       // internal Post._id for logging
}

export interface LinkedInPostResult {
  success: boolean;
  platform: 'linkedin';
  linkedInPostId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LINKEDIN_API = 'https://api.linkedin.com/v2';

function linkedInHeaders(accessToken: string, extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  };
}

function getLinkedInErrorMessage(error: any): string {
  const data = error.response?.data;
  
  if (data) {
    logger.error(`[LinkedIn] API Error Data: ${JSON.stringify(data)}`);
  } else if (error.request) {
    logger.error(`[LinkedIn] No response received from API. Code: ${error.code}, Message: ${error.message}`);
    // Log more details about the request failure
    if (error.code === 'ECONNREFUSED') logger.error('[LinkedIn] Connection refused. Check if the API endpoint is accessible.');
    if (error.code === 'ETIMEDOUT') logger.error('[LinkedIn] Connection timed out.');
  } else {
    logger.error(`[LinkedIn] Request setup error: ${error.message}`);
  }

  // Final fallback log for debugging
  logger.error(`[LinkedIn] Error setup/request failed: ${error.message}`);

  return (
    data?.message ||
    data?.serviceErrorCode ||
    error.response?.statusText ||
    error.message ||
    'LinkedIn API request failed'
  );
}

/**
 * Resolve a media URL to either an absolute local disk path or null (meaning
 * it is already a remote https:// URL and should be used as-is).
 */
function resolveLocalUploadPath(mediaUrl?: string): string | null {
  if (!mediaUrl) return null;

  const normalizedUrl = mediaUrl.replace(/\\/g, '/');
  
  // Look for "uploads/" in the URL (case-insensitive)
  const uploadsSearchStr = 'uploads/';
  const uploadsIndex = normalizedUrl.toLowerCase().indexOf(uploadsSearchStr);

  if (uploadsIndex === -1) return null;

  // Extract everything after "uploads/"
  const relativeUploadPath = decodeURIComponent(
    normalizedUrl.slice(uploadsIndex + uploadsSearchStr.length)
  );
  
  const uploadRoot = path.resolve(process.cwd(), envConfig.uploadRootDir);
  let absolutePath = path.resolve(uploadRoot, relativeUploadPath);

  // If not found in process.cwd()/uploads, try project_root/server/uploads
  if (!fs.existsSync(absolutePath)) {
    const fallbackRoot = path.resolve(process.cwd(), 'server', envConfig.uploadRootDir);
    const fallbackPath = path.resolve(fallbackRoot, relativeUploadPath);
    if (fs.existsSync(fallbackPath)) {
      absolutePath = fallbackPath;
    }
  }

  logger.info(`[LinkedIn] Resolved local upload path: ${absolutePath}`);
  
  // Security check: ensure the path is within a valid uploads directory
  const isSafe = absolutePath.includes(envConfig.uploadRootDir);
  if (!isSafe) {
    logger.warn(`[LinkedIn] Path security check failed for: ${absolutePath}`);
    return null;
  }

  return absolutePath;
}

function resolveAgenticMediaUrl(mediaUrl?: string) {
  if (!mediaUrl) return null;
  const normalizedUrl = mediaUrl.replace(/\\/g, '/');
  
  if (normalizedUrl.startsWith('social_media_posts/')) {
    return path.resolve(process.cwd(), '../AgenticServer/media', normalizedUrl);
  }
  
  // Also handle full URLs pointing to agentic media
  const marker = '/social_media_posts/';
  const idx = normalizedUrl.indexOf(marker);
  if (idx !== -1) {
    const rel = normalizedUrl.slice(idx + 1); // "social_media_posts/..."
    
    // Try multiple possible locations for AgenticServer/media
    const possibleRoots = [
      path.resolve(process.cwd(), '../AgenticServer/media'),
      path.resolve(process.cwd(), 'AgenticServer/media'),
      path.resolve(process.cwd(), '..', 'AgenticServer', 'media')
    ];

    for (const root of possibleRoots) {
      const fullPath = path.resolve(root, rel);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    // Fallback to first one if none exist yet (for logging purposes)
    return path.resolve(process.cwd(), '../AgenticServer/media', rel);
  }
  
  return null;
}

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

/**
 * Check whether a stored token is expired.
 * Throws AppError if expired so callers receive a clean structured error.
 */
export function assertTokenNotExpired(expiresAt?: Date): void {
  if (expiresAt && new Date() >= expiresAt) {
    throw new AppError(
      'LinkedIn access token has expired. Please reconnect your LinkedIn account.',
      HTTP_STATUS.UNAUTHORIZED
    );
  }
}

// ---------------------------------------------------------------------------
// Text post
// ---------------------------------------------------------------------------

export async function postTextToLinkedIn({
  accessToken,
  personId,
  text,
}: {
  accessToken: string;
  personId: string;
  text: string;
}): Promise<string> {
  if (!text || !text.trim()) {
    throw new AppError('Post text cannot be empty.', HTTP_STATUS.BAD_REQUEST);
  }

  const body = {
    author: personId,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: text.trim() },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  logger.info(`[LinkedIn] Posting text for ${personId}`);

  const response = await axios.post(`${LINKEDIN_API}/ugcPosts`, body, {
    headers: linkedInHeaders(accessToken),
  });

  // LinkedIn returns the new post URN in the x-restli-id header
  return response.headers['x-restli-id'] || response.data?.id || '';
}

// ---------------------------------------------------------------------------
// Image post (3-step flow)
// ---------------------------------------------------------------------------

async function registerImageUpload(accessToken: string, personId: string) {
  const body = {
    registerUploadRequest: {
      owner: personId,
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      serviceRelationships: [
        {
          identifier: 'urn:li:userGeneratedContent',
          relationshipType: 'OWNER',
        },
      ],
    },
  };

  const response = await axios.post(
    `${LINKEDIN_API}/assets?action=registerUpload`,
    body,
    { headers: linkedInHeaders(accessToken) }
  );

  const value = response.data?.value;
  const uploadUrl: string =
    value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
  const asset: string = value?.asset;

  if (!uploadUrl || !asset) {
    throw new AppError(
      'LinkedIn returned an invalid image upload registration response.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  return { uploadUrl, asset };
}

async function uploadImageBinary(uploadUrl: string, accessToken: string, mediaUrl: string) {
  const localPath = resolveLocalUploadPath(mediaUrl) || resolveAgenticMediaUrl(mediaUrl);
  logger.info(`[LinkedIn] uploadImageBinary: localPath resolved to: ${localPath} for mediaUrl: ${mediaUrl}`);

  if (localPath) {
    if (!fs.existsSync(localPath)) {
      logger.error(`[LinkedIn] File NOT found at absolute path: ${localPath}`);
      throw new AppError('Uploaded image file was not found on the server.', HTTP_STATUS.BAD_REQUEST);
    }
    const fileStream = fs.createReadStream(localPath);
    await axios.put(uploadUrl, fileStream, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
    });
  } else {
    // Remote URL: download and re-upload
    const imageResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    await axios.put(uploadUrl, imageResponse.data, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
    });
  }
}

export async function postImageToLinkedIn({
  accessToken,
  personId,
  text,
  mediaUrl,
}: {
  accessToken: string;
  personId: string;
  text: string;
  mediaUrl: string;
}): Promise<string> {
  if (!mediaUrl) {
    throw new AppError('mediaUrl is required for image posts.', HTTP_STATUS.BAD_REQUEST);
  }

  logger.info(`[LinkedIn] Registering image upload for ${personId}`);
  const { uploadUrl, asset } = await registerImageUpload(accessToken, personId);

  logger.info(`[LinkedIn] Uploading image binary to ${uploadUrl}`);
  await uploadImageBinary(uploadUrl, accessToken, mediaUrl);

  const body = {
    author: personId,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: text?.trim() || '' },
        shareMediaCategory: 'IMAGE',
        media: [
          {
            status: 'READY',
            description: { text: text?.trim() || '' },
            media: asset,
            title: { text: 'Image' },
          },
        ],
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  logger.info(`[LinkedIn] Publishing image post for ${personId}`);
  const response = await axios.post(`${LINKEDIN_API}/ugcPosts`, body, {
    headers: linkedInHeaders(accessToken),
  });

  return response.headers['x-restli-id'] || response.data?.id || '';
}

// ---------------------------------------------------------------------------
// Video post (register → upload → poll → publish)
// ---------------------------------------------------------------------------

async function registerVideoUpload(accessToken: string, personId: string) {
  const body = {
    registerUploadRequest: {
      owner: personId,
      recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
      serviceRelationships: [
        {
          identifier: 'urn:li:userGeneratedContent',
          relationshipType: 'OWNER',
        },
      ],
    },
  };

  const response = await axios.post(
    `${LINKEDIN_API}/assets?action=registerUpload`,
    body,
    { headers: linkedInHeaders(accessToken) }
  );

  const value = response.data?.value;
  const uploadUrl: string =
    value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
  const asset: string = value?.asset;

  if (!uploadUrl || !asset) {
    throw new AppError(
      'LinkedIn returned an invalid video upload registration response.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  return { uploadUrl, asset };
}

async function uploadVideoBinary(uploadUrl: string, accessToken: string, mediaUrl: string) {
  const localPath = resolveLocalUploadPath(mediaUrl) || resolveAgenticMediaUrl(mediaUrl);

  if (localPath) {
    if (!fs.existsSync(localPath)) {
      throw new AppError('Uploaded video file was not found on the server.', HTTP_STATUS.BAD_REQUEST);
    }
    const fileStream = fs.createReadStream(localPath);
    const stat = fs.statSync(localPath);
    await axios.put(uploadUrl, fileStream, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stat.size),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } else {
    const videoResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    await axios.put(uploadUrl, videoResponse.data, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  }
}

async function pollVideoProcessingStatus(
  accessToken: string,
  asset: string,
  maxAttempts = 20,
  intervalMs = 5000
): Promise<void> {
  const assetId = asset.replace('urn:li:digitalmediaAsset:', '');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const response = await axios.get(`${LINKEDIN_API}/assets/${assetId}`, {
      headers: linkedInHeaders(accessToken),
    });

    const status: string = response.data?.recipes?.[0]?.status ?? '';
    logger.info(`[LinkedIn] Video processing status (attempt ${attempt}): ${status}`);

    if (status === 'AVAILABLE') return;
    if (status === 'PROCESSING_FAILED') {
      throw new AppError('LinkedIn video processing failed.', HTTP_STATUS.BAD_REQUEST);
    }
  }

  throw new AppError(
    'LinkedIn video processing timed out. The video may still be processing.',
    HTTP_STATUS.BAD_REQUEST
  );
}

export async function postVideoToLinkedIn({
  accessToken,
  personId,
  text,
  mediaUrl,
}: {
  accessToken: string;
  personId: string;
  text: string;
  mediaUrl: string;
}): Promise<string> {
  if (!mediaUrl) {
    throw new AppError('mediaUrl is required for video posts.', HTTP_STATUS.BAD_REQUEST);
  }

  logger.info(`[LinkedIn] Registering video upload for ${personId}`);
  const { uploadUrl, asset } = await registerVideoUpload(accessToken, personId);

  logger.info(`[LinkedIn] Uploading video binary to ${uploadUrl}`);
  await uploadVideoBinary(uploadUrl, accessToken, mediaUrl);

  logger.info(`[LinkedIn] Polling video processing status for asset ${asset}`);
  await pollVideoProcessingStatus(accessToken, asset);

  const body = {
    author: personId,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: text?.trim() || '' },
        shareMediaCategory: 'VIDEO',
        media: [
          {
            status: 'READY',
            description: { text: text?.trim() || '' },
            media: asset,
            title: { text: 'Video' },
          },
        ],
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  logger.info(`[LinkedIn] Publishing video post for ${personId}`);
  const response = await axios.post(`${LINKEDIN_API}/ugcPosts`, body, {
    headers: linkedInHeaders(accessToken),
  });

  return response.headers['x-restli-id'] || response.data?.id || '';
}

// ---------------------------------------------------------------------------
// Multi-image post (register + upload each → publish with all assets)
// ---------------------------------------------------------------------------

export async function postMultiImageToLinkedIn({
  accessToken,
  personId,
  text,
  mediaUrls,
}: {
  accessToken: string;
  personId: string;
  text: string;
  mediaUrls: string[];
}): Promise<string> {
  if (!mediaUrls?.length) {
    throw new AppError('At least one image URL is required.', HTTP_STATUS.BAD_REQUEST);
  }

  // LinkedIn allows up to 20 images per post
  const urls = mediaUrls.slice(0, 20);

  logger.info(`[LinkedIn] Registering ${urls.length} image(s) for ${personId}`);

  // Register and upload all images in parallel
  const assets = await Promise.all(
    urls.map(async (url, idx) => {
      const { uploadUrl, asset } = await registerImageUpload(accessToken, personId);
      logger.info(`[LinkedIn] Uploading image ${idx + 1}/${urls.length}`);
      await uploadImageBinary(uploadUrl, accessToken, url);
      return asset;
    })
  );

  const mediaItems = assets.map((asset, idx) => ({
    status: 'READY',
    media: asset,
    title: { text: `Image ${idx + 1}` },
  }));

  const body = {
    author: personId,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: text?.trim() || '' },
        shareMediaCategory: 'IMAGE',
        media: mediaItems,
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  logger.info(`[LinkedIn] Publishing multi-image post (${assets.length} images)`);
  const response = await axios.post(`${LINKEDIN_API}/ugcPosts`, body, {
    headers: linkedInHeaders(accessToken),
  });

  return response.headers['x-restli-id'] || response.data?.id || '';
}

// ---------------------------------------------------------------------------
// Unified entry-point
// ---------------------------------------------------------------------------

export async function postToLinkedIn(options: LinkedInPostOptions): Promise<LinkedInPostResult> {
  const { type, text, mediaUrl, mediaUrls, account, postId } = options;
  const { accessToken, personId } = account;

  const logEntry: Partial<ILinkedInPostLog> = {
    postId,
    type,
    platform: 'linkedin',
    requestPayload: { type, text, mediaUrl, imagesCount: mediaUrls?.length, personId },
    timestamp: new Date(),
  };

  try {
    let linkedInPostId: string;

    if (type === 'video') {
      linkedInPostId = await postVideoToLinkedIn({ accessToken, personId, text, mediaUrl: mediaUrl! });
    } else if (type === 'multi-image') {
      const urls = mediaUrls?.length ? mediaUrls : mediaUrl ? [mediaUrl] : [];
      if (!urls.length) throw new AppError('No image URLs provided.', HTTP_STATUS.BAD_REQUEST);
      linkedInPostId = urls.length === 1
        ? await postImageToLinkedIn({ accessToken, personId, text, mediaUrl: urls[0] })
        : await postMultiImageToLinkedIn({ accessToken, personId, text, mediaUrls: urls });
    } else if (type === 'image') {
      linkedInPostId = await postImageToLinkedIn({ accessToken, personId, text, mediaUrl: mediaUrl! });
    } else {
      linkedInPostId = await postTextToLinkedIn({ accessToken, personId, text });
    }

    logEntry.status = 'success';
    logEntry.linkedInPostId = linkedInPostId;
    logEntry.responsePayload = { linkedInPostId };

    logger.info(`[LinkedIn] Published successfully. URN: ${linkedInPostId}`);
    return { success: true, platform: 'linkedin', linkedInPostId };
  } catch (error: any) {
    const errorMessage = getLinkedInErrorMessage(error);

    logEntry.status = 'failed';
    logEntry.errorMessage = errorMessage;
    logEntry.responsePayload = { statusCode: error.response?.status, data: error.response?.data };

    logger.error(`[LinkedIn] Posting failed: ${errorMessage}`);
    return { success: false, platform: 'linkedin', error: errorMessage };
  } finally {
    try {
      await LinkedInToken.updateOne(
        { personId },
        { $push: { postLogs: logEntry as ILinkedInPostLog } }
      );
    } catch (logError: any) {
      logger.warn(`[LinkedIn] Failed to write post log: ${logError.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Token retrieval helper used by the controller
// ---------------------------------------------------------------------------

export async function getLinkedInTokenForUser(userId: ObjectIdType) {
  return LinkedInToken.findOne({ user: userId });
}

// ---------------------------------------------------------------------------
// Direct publish — no pre-existing Post document needed
// Fetches stored token from DB, posts immediately
// ---------------------------------------------------------------------------

export interface DirectLinkedInPublishOptions {
  userId: ObjectIdType;
  type: 'text' | 'image' | 'video';
  text: string;
  mediaUrl?: string;
}

export interface DirectLinkedInPublishResult {
  success: boolean;
  platform: 'linkedin';
  linkedInPostId?: string;
  error?: string;
}

export async function publishDirectToLinkedIn(
  options: DirectLinkedInPublishOptions
): Promise<DirectLinkedInPublishResult> {
  const { userId, type, text, mediaUrl } = options;

  if (!text || !text.trim()) {
    throw new AppError('Post text cannot be empty.', HTTP_STATUS.BAD_REQUEST);
  }
  if ((type === 'image' || type === 'video') && !mediaUrl) {
    throw new AppError(`mediaUrl is required for ${type} posts.`, HTTP_STATUS.BAD_REQUEST);
  }

  const liToken = await getLinkedInTokenForUser(userId);
  if (!liToken) {
    throw new AppError(
      'LinkedIn account is not connected. Please connect via /auth/linkedin.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  assertTokenNotExpired(liToken.expiresAt);

  const result = await postToLinkedIn({
    type,
    text,
    mediaUrl,
    account: { accessToken: liToken.accessToken, personId: liToken.personId },
  });

  if (!result.success) {
    return { success: false, platform: 'linkedin', error: result.error };
  }

  return {
    success: true,
    platform: 'linkedin',
    linkedInPostId: result.linkedInPostId,
  };
}
