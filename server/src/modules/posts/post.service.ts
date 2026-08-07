import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { appConfig } from '../../config/app.config';
import { envConfig } from '../../config/env.config';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { FacebookToken, IFacebookPage } from '../facebook/facebook.model';
import { InstagramToken, IInstagramAccount } from '../instagram/instagram.model';
import {
  postToLinkedIn,
  getLinkedInTokenForUser,
  assertTokenNotExpired,
} from '../linkedin/linkedin.service';
import { YouTubeService } from '../youtube/youtube.service';
import { Post, IPost } from './post.model';
import { ObjectIdType } from '../../types/common.types';
import { AppError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { createApprovalToken } from '../../services/social-approval.service';
import { addCategoryAudienceSuggestion, addCategoryInterest } from '../categories/category.service';

export const createPost = async (data: Partial<IPost>): Promise<IPost> => {
  await addCategoryInterest(data.categoryId, data.topic);
  await addCategoryAudienceSuggestion(data.categoryId, data.targetAudience);
  const postType = String(data.postType || 'manual').toLowerCase() as IPost['postType'];
  const needsApproval = postType === 'ai';
  const post = new Post({
    ...data,
    postType,
    status: needsApproval ? 'waiting_for_approval' : data.status,
    approvalStatus: needsApproval ? 'content_generation_pending' : 'not_required',
    approvalToken: needsApproval ? createApprovalToken() : undefined,
    approvalRequestedAt: needsApproval ? new Date() : undefined,
  });

  await post.save();

  return await post.populate('categoryId');
};

export const getPosts = async (userId: ObjectIdType, filters: any = {}): Promise<IPost[]> => {
  return await Post.find({ userId, ...filters })
    .sort({ createdAt: -1 })
    .populate('categoryId')
    .populate({
      path: 'automationId',
      populate: {
        path: 'categoryId',
      },
    });
};

export const getPostsPaged = async (userId: ObjectIdType, filters: any = {}, page: number = 1, limit: number = 20): Promise<{ posts: IPost[], total: number }> => {
  const query = { userId, ...filters };
  const total = await Post.countDocuments(query);
  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('categoryId')
    .populate({
      path: 'automationId',
      populate: {
        path: 'categoryId',
      },
    });
  return { posts, total };
};

export const updatePost = async (id: string, data: Partial<IPost>): Promise<IPost | null> => {
  await addCategoryInterest(data.categoryId, data.topic);
  await addCategoryAudienceSuggestion(data.categoryId, data.targetAudience);
  return await Post.findByIdAndUpdate(id, data, { new: true }).populate('categoryId');
};

export const deletePost = async (id: string): Promise<IPost | null> => {
  return await Post.findByIdAndDelete(id);
};

export const bulkDeletePosts = async (ids: string[]): Promise<any> => {
  return await Post.deleteMany({ _id: { $in: ids } });
};

export const updatePostStatus = async (id: string, status: 'pending' | 'scheduled' | 'posted' | 'failed', error?: string): Promise<IPost | null> => {

  const update: any = { status };
  if (status === 'posted') update.postedAt = new Date();
  if (error) update.errorMessage = error;
  return await Post.findByIdAndUpdate(id, update, { new: true });
};

const graphApiVersion = 'v19.0';
const instagramPageFields = [
  'id',
  'name',
  'access_token',
  'instagram_business_account{id,username,name}',
  'connected_instagram_account{id,username,name}',
].join(',');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png']);
const videoExtensions = new Set(['.mp4', '.mov']);

function getFacebookErrorMessage(error: any) {
  return error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Facebook posting failed';
}

function getInstagramErrorMessage(error: any) {
  return error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Instagram posting failed';
}

const mapPagesToInstagramAccounts = (pages: any[]): IInstagramAccount[] =>
  pages
    .map((page: any): IInstagramAccount | null => {
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
    .filter((account): account is IInstagramAccount => Boolean(account));

function resolveLocalUploadPath(mediaUrl?: string) {
  if (!mediaUrl) return null;

  const normalizedUrl = mediaUrl.replace(/\\/g, '/');
  const uploadsSearchStr = 'uploads/';
  const uploadsIndex = normalizedUrl.toLowerCase().indexOf(uploadsSearchStr);

  if (uploadsIndex === -1) {
    return null;
  }

  // Extract everything after "uploads/"
  const relativeUploadPath = decodeURIComponent(
    normalizedUrl.slice(uploadsIndex + uploadsSearchStr.length)
  );
  const uploadRoot = path.resolve(process.cwd(), envConfig.uploadRootDir);
  const absolutePath = path.resolve(uploadRoot, relativeUploadPath);

  // Security check: ensure the path is within the uploads directory
  if (!absolutePath.startsWith(uploadRoot + path.sep) && absolutePath !== uploadRoot) {
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
  
  return null;
}

async function postImageToFacebookPage(pageId: string, pageAccessToken: string, message: string, mediaUrl: string) {
  const localMediaPath = resolveLocalUploadPath(mediaUrl) || resolveAgenticMediaUrl(mediaUrl);

  if (localMediaPath) {
    if (!fs.existsSync(localMediaPath)) {
      throw new AppError('Uploaded image file was not found on the server.', HTTP_STATUS.BAD_REQUEST);
    }

    const form = new FormData();
    form.append('message', message);
    form.append('access_token', pageAccessToken);
    form.append('source', fs.createReadStream(localMediaPath));

    const response = await axios.post(
      `https://graph.facebook.com/${graphApiVersion}/${pageId}/photos`,
      form,
      { headers: form.getHeaders() }
    );

    return response.data;
  }

  const response = await axios.post(`https://graph.facebook.com/${graphApiVersion}/${pageId}/photos`, {
    message,
    url: mediaUrl,
    access_token: pageAccessToken,
  });

  return response.data;
}

async function postVideoToFacebookPage(pageId: string, pageAccessToken: string, message: string, videoUrl: string) {
  const localMediaPath = resolveLocalUploadPath(videoUrl) || resolveAgenticMediaUrl(videoUrl);

  if (localMediaPath) {
    if (!fs.existsSync(localMediaPath)) {
      throw new AppError('Uploaded video file was not found on the server.', HTTP_STATUS.BAD_REQUEST);
    }

    const form = new FormData();
    form.append('description', message);
    form.append('access_token', pageAccessToken);
    form.append('source', fs.createReadStream(localMediaPath));

    const response = await axios.post(
      `https://graph.facebook.com/${graphApiVersion}/${pageId}/videos`,
      form,
      { headers: form.getHeaders() }
    );

    return response.data;
  }

  const response = await axios.post(`https://graph.facebook.com/${graphApiVersion}/${pageId}/videos`, {
    description: message,
    file_url: videoUrl,
    access_token: pageAccessToken,
  });

  return response.data;
}

async function postTextToFacebookPage(pageId: string, pageAccessToken: string, message: string) {
  const response = await axios.post(`https://graph.facebook.com/${graphApiVersion}/${pageId}/feed`, {
    message,
    access_token: pageAccessToken,
  });

  return response.data;
}

async function refreshFacebookPages(fbToken: any): Promise<IFacebookPage[]> {
  const response = await axios.get(`https://graph.facebook.com/${graphApiVersion}/me/accounts`, {
    params: {
      access_token: fbToken.userAccessToken,
      fields: 'id,name,access_token',
    },
  });

  const pages = (response.data?.data || [])
    .filter((page: any) => page.id && page.name && page.access_token)
    .map((page: any) => ({
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      isActive: true,
    }));

  fbToken.pages = pages;
  await fbToken.save();

  return pages;
}

async function getFacebookPageForPosting(fbToken: any) {
  let pages: IFacebookPage[] = fbToken.pages || [];

  if (!pages.length) {
    pages = await refreshFacebookPages(fbToken);
  }

  return pages.find((item) => item.isActive) || pages[0];
}

function isLocalUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    
    // Check for localhost, 127.0.0.1, ::1
    if (['localhost', '127.0.0.1', '::1'].includes(host) || host.endsWith('.local')) {
      return true;
    }
    
    // Check for private IP ranges
    // 10.0.0.0 - 10.255.255.255
    // 172.16.0.0 - 172.31.255.255
    // 192.168.0.0 - 192.168.255.255
    const parts = host.split('.').map(Number);
    if (parts.length === 4) {
      if (parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

function getPublicMediaUrl(mediaUrl?: string) {
  const trimmedMediaUrl = mediaUrl?.trim();

  if (!trimmedMediaUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedMediaUrl)) {
    return trimmedMediaUrl;
  }

  const normalizedMediaUrl = trimmedMediaUrl.replace(/\\/g, '/');
  const uploadRoot = path.resolve(process.cwd(), envConfig.uploadRootDir);
  let normalizedPath = normalizedMediaUrl;

  if (/^[a-zA-Z]:\//.test(normalizedMediaUrl)) {
    const absolutePath = path.resolve(normalizedMediaUrl);

    if (!absolutePath.startsWith(uploadRoot + path.sep) && absolutePath !== uploadRoot) {
      throw new AppError('Instagram media must be inside the configured uploads directory.', HTTP_STATUS.BAD_REQUEST);
    }

    const relativeUploadPath = path.relative(uploadRoot, absolutePath).replace(/\\/g, '/');
    normalizedPath = `${appConfig.apiPrefix}/uploads/${relativeUploadPath}`;
  } else {
    normalizedPath = normalizedPath.replace(/^\/+/, '');

    if (normalizedPath.startsWith(`${appConfig.apiPrefix.replace(/^\//, '')}/uploads/`)) {
      normalizedPath = `/${normalizedPath}`;
    } else if (normalizedPath.startsWith('uploads/')) {
      normalizedPath = `${appConfig.apiPrefix}/${normalizedPath}`;
    } else if (normalizedPath.startsWith('SocialMediaAutomation/')) {
      normalizedPath = `${appConfig.apiPrefix}/uploads/${normalizedPath}`;
    } else if (!normalizedPath.startsWith('/')) {
      normalizedPath = `/${normalizedPath}`;
    }
  }

  // Ensure ALL remaining backslashes are converted to forward slashes before URL construction
  normalizedPath = normalizedPath.replace(/\\/g, '/');

  const baseUrl = envConfig.publicApiBaseUrl.trim().replace(/\/$/, '');
  return new URL(normalizedPath, baseUrl).toString();
}

function getMediaExtension(mediaUrl: string) {
  try {
    return path.extname(new URL(mediaUrl).pathname).toLowerCase();
  } catch {
    return path.extname(mediaUrl.split('?')[0] || mediaUrl).toLowerCase();
  }
}

function inferInstagramMediaKind(mediaUrl: string): 'image' | 'video' | null {
  const extension = getMediaExtension(mediaUrl);

  if (imageExtensions.has(extension)) {
    return 'image';
  }

  if (videoExtensions.has(extension)) {
    return 'video';
  }

  return null;
}

function assertInstagramMediaUrl(mediaUrl?: string) {
  const publicMediaUrl = getPublicMediaUrl(mediaUrl);

  if (!publicMediaUrl) {
    throw new AppError('Instagram posts require an image or video URL.', HTTP_STATUS.BAD_REQUEST);
  }

  if (isLocalUrl(publicMediaUrl)) {
    throw new AppError(
      'Instagram requires media URLs that Meta can reach publicly. Set PUBLIC_API_BASE_URL to your HTTPS domain or an HTTPS tunnel, then try again.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  return publicMediaUrl;
}

function getInstagramMediaForPost(post: IPost) {
  const candidates = [post.instagramImage, post.mediaUrl, post.videoUrl].filter((item): item is string => Boolean(item?.trim()));

  for (const candidate of candidates) {
    const publicUrl = assertInstagramMediaUrl(candidate);
    const mediaKind = inferInstagramMediaKind(publicUrl);

    if (mediaKind) {
      return {
        publicUrl,
        isVideo: mediaKind === 'video',
      };
    }
  }

  throw new AppError(
    'Instagram supports JPG, PNG, MP4, or MOV media. Please upload a supported photo or video file.',
    HTTP_STATUS.BAD_REQUEST
  );
}

async function refreshInstagramAccounts(igToken: any): Promise<IInstagramAccount[]> {
  const response = await axios.get(`https://graph.facebook.com/${graphApiVersion}/me/accounts`, {
    params: {
      access_token: igToken.userAccessToken,
      fields: 'id,name,access_token',
    },
  });

  const pages = await Promise.all(
    (response.data?.data || []).map(async (page: any) => {
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
        console.error('Instagram page lookup failed while publishing:', {
          pageId: page.id,
          pageName: page.name,
          error: error.response?.data?.error?.message || error.message,
        });
        return page;
      }
    })
  );

  const accounts = mapPagesToInstagramAccounts(pages);

  igToken.accounts = accounts;
  await igToken.save();

  return accounts;
}

async function getInstagramAccountForPosting(igToken: any) {
  let accounts: IInstagramAccount[] = igToken.accounts || [];

  if (!accounts.length) {
    accounts = await refreshInstagramAccounts(igToken);
  }

  return accounts.find((item) => item.isActive) || accounts[0];
}

async function waitForInstagramContainer(creationId: string, accessToken: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await axios.get(`https://graph.facebook.com/${graphApiVersion}/${creationId}`, {
      params: {
        fields: 'status_code',
        access_token: accessToken,
      },
    });

    const statusCode = response.data?.status_code;
    if (!statusCode || statusCode === 'FINISHED') {
      return;
    }

    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw new AppError(`Instagram media processing failed with status ${statusCode}.`, HTTP_STATUS.BAD_REQUEST);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new AppError('Instagram media is still processing. Please try publishing again in a minute.', HTTP_STATUS.BAD_REQUEST);
}

async function publishInstagramMedia(account: IInstagramAccount, caption: string, mediaUrl: string, isVideo: boolean) {
  const containerParams: Record<string, string | boolean> = {
    caption,
    access_token: account.pageAccessToken,
  };

  if (isVideo) {
    containerParams.media_type = 'REELS';
    containerParams.video_url = mediaUrl;
    containerParams.share_to_feed = true;
  } else {
    containerParams.media_type = 'IMAGE';
    containerParams.image_url = mediaUrl;
  }

  const containerResponse = await axios.post(
    `https://graph.facebook.com/${graphApiVersion}/${account.instagramUserId}/media`,
    null,
    { params: containerParams }
  );

  const creationId = containerResponse.data?.id;
  if (!creationId) {
    throw new AppError('Instagram did not return a media container id.', HTTP_STATUS.BAD_REQUEST);
  }

  if (isVideo) {
    await waitForInstagramContainer(creationId, account.pageAccessToken);
  }

  const publishResponse = await axios.post(
    `https://graph.facebook.com/${graphApiVersion}/${account.instagramUserId}/media_publish`,
    null,
    {
      params: {
        creation_id: creationId,
        access_token: account.pageAccessToken,
      },
    }
  );

  return publishResponse.data;
}

export const sendPostNow = async (id: string, userId: ObjectIdType, targetPageId?: string, platformOverride?: string): Promise<IPost> => {
  const post = await Post.findOne({ _id: id, userId });

  if (!post) {
    throw new AppError('Post not found.', HTTP_STATUS.NOT_FOUND);
  }

  if (post.postType === 'ai' && post.approvalStatus !== 'approved') {
    throw new AppError('This post is not approved.', HTTP_STATUS.BAD_REQUEST);
  }

  // Ensure platforms array exists to avoid Mongoose validation errors on save
  if (!post.platforms) {
    post.platforms = [];
  }

  const platformsToProcess = (platformOverride ? [platformOverride] : post.platforms) as string[];

  if (!platformsToProcess || platformsToProcess.length === 0) {
    throw new AppError('No platforms specified for this post.', HTTP_STATUS.BAD_REQUEST);
  }

  let finalPost: IPost = post;

  for (const platform of platformsToProcess) {
    try {
      if (platform === 'youtube') {
        finalPost = await sendYouTubePostNow(post, userId);
      } else if (platform === 'linkedin') {
        finalPost = await dispatchToLinkedIn(post, userId);
      } else if (['facebook', 'instagram'].includes(platform)) {
        finalPost = await sendFacebookPostNow(post, userId, platform as any, targetPageId);
      } else {
        logger.warn(`[SendNow] Unsupported platform: ${platform}`);
      }
    } catch (error: any) {
      logger.error(`[SendNow] Failed to send to ${platform}: ${error.message}`);
      // If we're sending to multiple, we continue. If it was a direct override, we throw.
      if (platformOverride) throw error;
    }
  }

  return finalPost;
};

// ---------------------------------------------------------------------------
// YouTube dispatch
// ---------------------------------------------------------------------------

async function sendYouTubePostNow(post: IPost, userId: ObjectIdType): Promise<IPost> {
  let title = post.topic || 'New Video';
  let description = post.content || '';
  let tags: string[] = [];

  // Use platform-specific content if available
  if (post.platformSpecificContent && (post.platformSpecificContent as any).youtube) {
    const specific = (post.platformSpecificContent as any).youtube;
    if (specific.title) title = specific.title;
    if (specific.description) description = specific.description;
    if (Array.isArray(specific.tags)) tags = specific.tags;
  }

  const videoUrl = post.videoUrl || post.mediaUrl;

  if (!videoUrl) {
    throw new AppError('YouTube requires a video file. Please upload a video in the "Video" or "Media" field before posting.', HTTP_STATUS.BAD_REQUEST);
  }

  try {
    logger.info(`[YouTube] Dispatching video upload for post ${post._id}`);
    
    await YouTubeService.uploadVideo({
      userId: String(userId),
      title,
      description,
      videoUrl,
      tags,
      postId: String(post._id),
    });

    post.status = 'posted';
    post.postedAt = new Date();
    post.errorMessage = undefined;
    return await post.save();
  } catch (error: any) {
    post.status = 'failed';
    post.errorMessage = error.message || 'YouTube posting failed';
    await post.save();
    throw new AppError(post.errorMessage || 'YouTube posting failed', HTTP_STATUS.BAD_REQUEST);
  }
}

// ---------------------------------------------------------------------------
// Facebook dispatch (extracted from original sendPostNow)
// ---------------------------------------------------------------------------

async function postMultiImageToFacebookPage(pageId: string, pageAccessToken: string, message: string, mediaUrls: string[]) {
  const photoIds: string[] = [];

  for (const url of mediaUrls) {
    const localPath = resolveLocalUploadPath(url) || resolveAgenticMediaUrl(url);
    let photoResponse;

    if (localPath && fs.existsSync(localPath)) {
      const form = new FormData();
      form.append('published', 'false');
      form.append('access_token', pageAccessToken);
      form.append('source', fs.createReadStream(localPath));
      photoResponse = await axios.post(`https://graph.facebook.com/${graphApiVersion}/${pageId}/photos`, form, { headers: form.getHeaders() });
    } else {
      photoResponse = await axios.post(`https://graph.facebook.com/${graphApiVersion}/${pageId}/photos`, {
        url,
        published: 'false',
        access_token: pageAccessToken,
      });
    }
    if (photoResponse.data?.id) photoIds.push(photoResponse.data.id);
  }

  if (photoIds.length === 0) return null;

  const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
  const response = await axios.post(`https://graph.facebook.com/${graphApiVersion}/${pageId}/feed`, {
    message,
    attached_media: attachedMedia,
    access_token: pageAccessToken,
  });

  return response.data;
}

async function publishInstagramCarousel(account: IInstagramAccount, caption: string, mediaUrls: string[]) {
  const childrenIds: string[] = [];

  for (const url of mediaUrls) {
    const publicUrl = assertInstagramMediaUrl(url);
    const containerResponse = await axios.post(
      `https://graph.facebook.com/${graphApiVersion}/${account.instagramUserId}/media`,
      null,
      {
        params: {
          image_url: publicUrl,
          is_carousel_item: true,
          access_token: account.pageAccessToken,
        }
      }
    );
    if (containerResponse.data?.id) childrenIds.push(containerResponse.data.id);
  }

  if (childrenIds.length === 0) throw new AppError('Failed to create carousel items.', HTTP_STATUS.BAD_REQUEST);

  const carouselResponse = await axios.post(
    `https://graph.facebook.com/${graphApiVersion}/${account.instagramUserId}/media`,
    null,
    {
      params: {
        caption,
        media_type: 'CAROUSEL',
        children: childrenIds.join(','),
        access_token: account.pageAccessToken,
      }
    }
  );

  const creationId = carouselResponse.data?.id;
  if (!creationId) throw new AppError('Failed to create carousel container.', HTTP_STATUS.BAD_REQUEST);

  await waitForInstagramContainer(creationId, account.pageAccessToken);

  const publishResponse = await axios.post(
    `https://graph.facebook.com/${graphApiVersion}/${account.instagramUserId}/media_publish`,
    null,
    {
      params: {
        creation_id: creationId,
        access_token: account.pageAccessToken,
      },
    }
  );

  return publishResponse.data;
}

async function sendFacebookPostNow(post: IPost, userId: ObjectIdType, platform: string, targetPageId?: string): Promise<IPost> {
  let message = post.content?.trim() || post.topic?.trim();

  // Use platform-specific content if available
  if (post.platformSpecificContent) {
    const specific = post.platformSpecificContent[platform as keyof typeof post.platformSpecificContent] as any;
    if (specific) {
      if (platform === 'facebook' || platform === 'instagram') {
        const caption = (specific.caption || '').trim();
        const hashtags = Array.isArray(specific.hashtags) ? specific.hashtags : [];
        const hashtagsStr = hashtags.length > 0 ? hashtags.join(' ') : '';
        
        if (caption || hashtagsStr) {
          message = `${caption}${caption && hashtagsStr ? '\n\n' : ''}${hashtagsStr}`.trim();
        }
      } else if (platform === 'linkedin') {
        const content = (specific.content || '').trim();
        const hashtags = Array.isArray(specific.hashtags) ? specific.hashtags : [];
        const hashtagsStr = hashtags.length > 0 ? hashtags.join(' ') : '';
        
        if (content || hashtagsStr) {
          message = `${content}${content && hashtagsStr ? '\n\n' : ''}${hashtagsStr}`.trim();
        }
      }
    }
  }

  if (!message || message.trim().length === 0) {
    throw new AppError(`Facebook/Instagram publish error: The message field is empty. Please ensure the ${platform} caption is populated.`, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    if (platform === 'facebook') {
      const fbToken = await FacebookToken.findOne({ user: userId });
      if (!fbToken) {
        throw new AppError('Facebook account is not connected.', HTTP_STATUS.BAD_REQUEST);
      }

      let page;
      if (targetPageId) {
        page = fbToken.pages.find(p => p.pageId === targetPageId);
        if (!page) {
          throw new AppError('Selected Facebook page not found.', HTTP_STATUS.BAD_REQUEST);
        }
      } else {
        page = await getFacebookPageForPosting(fbToken);
      }

      if (!page) {
        throw new AppError(
          'No Facebook page is available for this account. Reconnect Facebook after confirming you have admin access to the page.',
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (post.videoUrl) {
        await postVideoToFacebookPage(page.pageId, page.pageAccessToken, message, post.videoUrl);
      } else if (post.mediaUrls && post.mediaUrls.length > 1) {
        await postMultiImageToFacebookPage(page.pageId, page.pageAccessToken, message, post.mediaUrls);
      } else if (post.mediaUrls && post.mediaUrls.length === 1) {
        await postImageToFacebookPage(page.pageId, page.pageAccessToken, message, post.mediaUrls[0]);
      } else if (post.mediaUrl) {
        await postImageToFacebookPage(page.pageId, page.pageAccessToken, message, post.mediaUrl);
      } else {
        await postTextToFacebookPage(page.pageId, page.pageAccessToken, message);
      }
    } else {
      const igToken = await InstagramToken.findOne({ user: userId });
      if (!igToken) {
        throw new AppError('Instagram account is not connected.', HTTP_STATUS.BAD_REQUEST);
      }

      const account = await getInstagramAccountForPosting(igToken);
      if (!account) {
        throw new AppError(
          'No Instagram professional account is available. Connect an Instagram Business or Creator account linked to a Facebook Page.',
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (post.mediaUrls && post.mediaUrls.length > 1) {
        console.log(`Publishing Instagram Carousel for post ${post._id} with ${post.mediaUrls.length} images.`);
        await publishInstagramCarousel(account, message, post.mediaUrls);
      } else {
        const instagramMedia = getInstagramMediaForPost(post);
        console.log('Publishing Instagram single media:', {
          postId: String(post._id),
          mediaUrl: instagramMedia.publicUrl,
          mediaType: instagramMedia.isVideo ? 'video' : 'image',
        });
        await publishInstagramMedia(account, message, instagramMedia.publicUrl, instagramMedia.isVideo);
      }
    }

    post.status = 'posted';
    post.postedAt = new Date();
    post.errorMessage = undefined;
    return await post.save();
  } catch (error: any) {
    post.status = 'failed';
    post.errorMessage = platform === 'instagram' ? getInstagramErrorMessage(error) : getFacebookErrorMessage(error);
    await post.save();

    if (error instanceof AppError) throw error;
    throw new AppError(post.errorMessage || `${platform} posting failed`, HTTP_STATUS.BAD_REQUEST);
  }
}

// ---------------------------------------------------------------------------
// LinkedIn dispatch
// ---------------------------------------------------------------------------

async function dispatchToLinkedIn(post: IPost, userId: ObjectIdType): Promise<IPost> {
  let message = post.content?.trim() || post.topic?.trim();

  // Check for platform specific content
  if (post.platformSpecificContent && (post.platformSpecificContent as any).linkedin) {
    const specific = (post.platformSpecificContent as any).linkedin;
    if (specific.content) {
      const hashtags = Array.isArray(specific.hashtags) ? specific.hashtags : [];
      message = `${specific.content}${hashtags.length > 0 ? `\n\n${hashtags.join(' ')}` : ''}`.trim();
    }
  }

  if (!message) {
    throw new AppError('Post content is required before sending to LinkedIn.', HTTP_STATUS.BAD_REQUEST);
  }

  const liToken = await getLinkedInTokenForUser(userId);
  if (!liToken) {
    throw new AppError('LinkedIn account is not connected.', HTTP_STATUS.BAD_REQUEST);
  }

  assertTokenNotExpired(liToken.expiresAt);

  // Determine post type from stored fields
  // mediaUrls (plural) takes priority for multi-image; then single mediaUrl; then video; then text
  let type: 'text' | 'image' | 'multi-image' | 'video' = 'text';
  let mediaUrl: string | undefined;
  let mediaUrls: string[] | undefined;

  if (post.videoUrl) {
    type = 'video';
    mediaUrl = post.videoUrl;
  } else if (post.mediaUrls && post.mediaUrls.length > 1) {
    type = 'multi-image';
    mediaUrls = post.mediaUrls;
  } else if (post.mediaUrls && post.mediaUrls.length === 1) {
    type = 'image';
    mediaUrl = post.mediaUrls[0];
  } else if (post.mediaUrl) {
    type = 'image';
    mediaUrl = post.mediaUrl;
  }

  const result = await postToLinkedIn({
    type,
    text: message,
    mediaUrl,
    mediaUrls,
    account: { accessToken: liToken.accessToken, personId: liToken.personId },
    postId: String(post._id),
  });

  if (!result.success) {
    post.status = 'failed';
    post.errorMessage = result.error || 'LinkedIn posting failed';
    await post.save();
    throw new AppError(post.errorMessage, HTTP_STATUS.BAD_REQUEST);
  }

  post.status = 'posted';
  post.postedAt = new Date();
  post.errorMessage = undefined;
  return await post.save();
}
