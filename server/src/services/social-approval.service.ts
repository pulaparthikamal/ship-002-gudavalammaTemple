import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { envConfig } from '../config/env.config';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { Post, IPost } from '../modules/posts/post.model';
import { buildSocialApprovalEmailHtml, buildApprovalPreviewHtml } from '../templates/social-approval-email.template';
import { AppError } from '../utils/error.util';
import { sendMail } from '../utils/mail.util';
import { logger } from '../utils/logger.util';

export const createApprovalToken = () => crypto.randomBytes(32).toString('hex');

const getPublicMediaUrl = (mediaUrl?: string, hostUrl?: string) => {
  if (!mediaUrl?.trim()) return null;

  const normalizedUrl = mediaUrl.replace(/\\/g, '/');
  
  // Case 1: contains uploads/
  const uploadsSearchStr = 'uploads/';
  const uploadsIndex = normalizedUrl.toLowerCase().indexOf(uploadsSearchStr);
  if (uploadsIndex !== -1) {
    const relativePath = normalizedUrl.slice(uploadsIndex + uploadsSearchStr.length).replace(/^\/+/, '');
    const baseUrl = (hostUrl || envConfig.publicApiBaseUrl).trim().replace(/\/$/, '');
    return new URL(`/api/v1/uploads/${relativePath}`, baseUrl).toString();
  }

  // Case 2: contains social_media_posts/
  const socialSearchStr = 'social_media_posts/';
  const socialIndex = normalizedUrl.toLowerCase().indexOf(socialSearchStr);
  if (socialIndex !== -1) {
    const relativePath = normalizedUrl.slice(socialIndex + socialSearchStr.length).replace(/^\/+/, '');
    const baseUrl = (hostUrl || envConfig.publicApiBaseUrl).trim().replace(/\/$/, '');
    return new URL(`/social_media_posts/${relativePath}`, baseUrl).toString();
  }

  // Case 3: Starts with http but not a local path -> external URL
  if (/^https?:\/\//i.test(normalizedUrl)) {
    return normalizedUrl;
  }

  // Case 4: Relative path (default fallback)
  const cleanPath = normalizedUrl.replace(/^\/+/, '');
  const baseUrl = (hostUrl || envConfig.publicApiBaseUrl).trim().replace(/\/$/, '');
  return new URL(`/${cleanPath}`, baseUrl).toString();
};

const getLocalMediaFilePath = (mediaUrl?: string): string | null => {
  if (!mediaUrl?.trim()) return null;

  const normalizedUrl = mediaUrl.replace(/\\/g, '/');

  // Case 1: Check for uploads/
  const uploadsSearchStr = 'uploads/';
  const uploadsIndex = normalizedUrl.toLowerCase().indexOf(uploadsSearchStr);
  if (uploadsIndex !== -1) {
    const relativeUploadPath = decodeURIComponent(
      normalizedUrl.slice(uploadsIndex + uploadsSearchStr.length)
    );
    const uploadRoot = path.resolve(process.cwd(), envConfig.uploadRootDir || 'uploads');
    const absolutePath = path.resolve(uploadRoot, relativeUploadPath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return absolutePath;
    }
  }

  // Case 2: Check for social_media_posts/
  const socialSearchStr = 'social_media_posts/';
  const socialIndex = normalizedUrl.toLowerCase().indexOf(socialSearchStr);
  if (socialIndex !== -1) {
    const relativeSocialPath = decodeURIComponent(
      normalizedUrl.slice(socialIndex + socialSearchStr.length)
    );
    const absolutePath = path.resolve(process.cwd(), '../AgenticServer/media/social_media_posts', relativeSocialPath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return absolutePath;
    }
  }

  // Case 3: Relative path (if not external URL)
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    const cleanPath = normalizedUrl.replace(/^\/?(api\/v1\/)?/, '');
    const localPath = path.resolve(process.cwd(), cleanPath);
    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      return localPath;
    }
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fix #1 + #2: Accept per-post override email; email links directly call the
//              backend GET approve/reject endpoints (no frontend route needed).
// ─────────────────────────────────────────────────────────────────────────────
export const sendSocialApprovalEmail = async (post: IPost, overrideEmail?: string) => {
  if (!post.approvalToken) {
    throw new AppError('Approval token is missing for this AI post.', HTTP_STATUS.BAD_REQUEST);
  }

  const apiBase = envConfig.publicApiBaseUrl.replace(/\/$/, '');
  const token = post.approvalToken;

  // Direct one-click approve/reject links
  const approveUrl = `${apiBase}/api/v1/social/posts/approval/${token}/approve`;
  const rejectUrl  = `${apiBase}/api/v1/social/posts/approval/${token}/reject`;
  // Preview page link — opens rich HTML with full content + approve/reject buttons
  const previewUrl = `${apiBase}/api/v1/social/posts/approval/${token}/preview`;

  const rawMedia = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]) || post.instagramImage || post.videoUrl;
  const mediaUrl = getPublicMediaUrl(rawMedia);
  const localFilePath = getLocalMediaFilePath(rawMedia);
  const imageCid = localFilePath ? `post-media-${post._id}` : null;
  const attachments = localFilePath
    ? [
        {
          filename: path.basename(localFilePath),
          path: localFilePath,
          cid: imageCid!,
        },
      ]
    : undefined;

  // Fix #1: use per-automation email override, fall back to env default
  const recipient = overrideEmail?.trim() || envConfig.socialApprovalEmail;

  await sendMail({
    to: recipient,
    subject: `[Action Required] Approve AI Post — ${post.platforms?.join('/') || 'Social'} | ${new Date(post.scheduledAt).toLocaleString()}`,
    html: buildSocialApprovalEmailHtml({
      appName: envConfig.appName,
      topic: post.topic,
      content: post.content,
      platforms: post.platforms || [],
      scheduledAt: post.scheduledAt,
      mediaUrl,
      imageCid,
      approveUrl,
      rejectUrl,
      previewUrl,
      platformSpecificContent: post.platformSpecificContent,
    }),
    text: `Preview: ${previewUrl}\nApprove: ${approveUrl}\nReject: ${rejectUrl}`,
    attachments,
  });

  logger.info(`[ApprovalEmail] Sent to ${recipient} for post ${post._id}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// requestApprovalEmailForPost — used for manual resend from UI
// ─────────────────────────────────────────────────────────────────────────────
export const requestApprovalEmailForPost = async (postId: string, userId?: string) => {
  const post = await Post.findOne({
    _id: postId,
    ...(userId ? { userId } : {}),
  });

  if (!post) throw new AppError('Post not found.', HTTP_STATUS.NOT_FOUND);
  if (post.postType !== 'ai') throw new AppError('Approval email is only required for AI posts.', HTTP_STATUS.BAD_REQUEST);
  if (post.approvalStatus === 'approved') throw new AppError('This AI post is already approved.', HTTP_STATUS.BAD_REQUEST);

  if (!post.approvalToken) post.approvalToken = createApprovalToken();

  // Fix #7: set content_generation_pending first, only mark email_sent AFTER send succeeds
  post.approvalStatus = 'content_generation_pending';
  post.status = 'waiting_for_approval';
  post.approvalRequestedAt = new Date();
  await post.save();

  try {
    await sendSocialApprovalEmail(post);
    post.approvalStatus = 'email_sent';
    post.status = 'waiting_for_approval';
    await post.save();
  } catch (err: any) {
    post.approvalStatus = 'email_failed';
    post.status = 'waiting_for_approval';
    await post.save();
    throw err;
  }

  return post;
};

// ─────────────────────────────────────────────────────────────────────────────
// getApprovalPreview — returns rich HTML preview page with approve/reject buttons
// ─────────────────────────────────────────────────────────────────────────────
export const getApprovalPreview = async (token: string, hostUrl?: string): Promise<{ post: IPost; html: string }> => {
  const post = await Post.findOne({ approvalToken: token });

  if (!post) {
    // Post might already have been actioned (token cleared) — return graceful HTML
    const errorHtml = buildApprovalPreviewHtml({
      topic: 'Post Not Found',
      content: 'This approval link is invalid or has already been used. The post may have already been approved or rejected.',
      platforms: [],
      scheduledAt: new Date().toISOString(),
      approveUrl: '#',
      rejectUrl: '#',
      alreadyActioned: undefined,
    });
    throw Object.assign(new AppError('Approval link invalid.', HTTP_STATUS.NOT_FOUND), { html: errorHtml });
  }

  const apiBase = (hostUrl || envConfig.publicApiBaseUrl).replace(/\/$/, '');
  const approveUrl = `${apiBase}/api/v1/social/posts/approval/${token}/approve`;
  const rejectUrl  = `${apiBase}/api/v1/social/posts/approval/${token}/reject`;
  const rawMedia = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]) || post.instagramImage || post.videoUrl;
  const mediaUrl = getPublicMediaUrl(rawMedia, hostUrl);

  const alreadyActioned = post.approvalStatus === 'approved'
    ? 'approved'
    : post.approvalStatus === 'rejected'
    ? 'rejected'
    : undefined;

  const html = buildApprovalPreviewHtml({
    topic: post.topic,
    content: post.content,
    platforms: post.platforms || [],
    scheduledAt: post.scheduledAt,
    mediaUrl,
    platformSpecificContent: post.platformSpecificContent,
    approveUrl,
    rejectUrl,
    alreadyActioned,
  });

  return { post, html };
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML response helper for browser-based approve/reject
// ─────────────────────────────────────────────────────────────────────────────
const buildResultHtml = (approved: boolean, headline: string, message: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${headline}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="background:#fff;border-radius:16px;padding:48px 40px;text-align:center;max-width:480px;box-shadow:0 8px 40px rgba(0,0,0,.1)">
    <div style="font-size:56px;margin-bottom:16px">${approved ? '✅' : '❌'}</div>
    <h1 style="color:${approved ? '#1e7e34' : '#c82333'};margin:0 0 12px;font-size:24px">${headline}</h1>
    <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0">${message}</p>
    <p style="margin-top:24px;font-size:13px;color:#94a3b8">You can close this tab.</p>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// approvePost — called via GET from email link
// Fix #5: handles already-approved gracefully (idempotent)
// ─────────────────────────────────────────────────────────────────────────────
export const approvePost = async (token: string, approvedByEmail?: string): Promise<{ post: IPost; html: string }> => {
  const post = await Post.findOne({ approvalToken: token });

  if (!post) {
    throw new AppError('Approval link is invalid or has expired.', HTTP_STATUS.NOT_FOUND);
  }

  // Guard: already approved — return friendly message
  if (post.approvalStatus === 'approved') {
    return {
      post,
      html: buildResultHtml(true, 'Already Approved', 'This post is already approved and scheduled for publishing. You can reject it using the Reject link in the same email.'),
    };
  }

  // Allow: approve even if previously rejected (override rejection)
  post.approvalStatus = 'approved';
  post.status = post.postingMode === 'now' ? 'pending' : 'scheduled';
  post.approvedAt = new Date();
  post.approvedByEmail = approvedByEmail || envConfig.socialApprovalEmail;
  // NOTE: Token is kept alive so the email Reject link also works after approval
  post.rejectionReason = undefined;
  (post as any).rejectedAt = undefined;
  await post.save();

  logger.info(`[ApprovalService] Post ${post._id} approved by ${post.approvedByEmail}`);

  return {
    post,
    html: buildResultHtml(true, 'Post Approved! ✅', `The post has been approved and is now scheduled for publishing at ${new Date(post.scheduledAt).toLocaleString('en-US', { hour12: true })}.<br><br>Changed your mind? Use the <strong>Reject</strong> link in the same email to reverse this decision.`),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// rejectPost — called via GET from email link
// Fix #11: sends a rejection notification email back to the sender
// ─────────────────────────────────────────────────────────────────────────────
export const rejectPost = async (token: string, reason?: string): Promise<{ post: IPost; html: string }> => {
  const post = await Post.findOne({ approvalToken: token });

  if (!post) {
    throw new AppError('Rejection link is invalid or has already been used.', HTTP_STATUS.NOT_FOUND);
  }

  // Guard: already rejected — return friendly message (idempotent same-action)
  if (post.approvalStatus === 'rejected') {
    return {
      post,
      html: buildResultHtml(false, 'Already Rejected', 'This post was already rejected.'),
    };
  }

  // Allow: reject even if previously approved (override approval)
  const rejectionReason = reason || 'Rejected via email link';
  post.approvalStatus = 'rejected';
  post.status = 'failed';
  (post as any).rejectedAt = new Date();
  post.rejectionReason = rejectionReason;
  // NOTE: Token is kept alive so the email Approve link also works after rejection
  post.approvedAt = undefined;
  post.approvedByEmail = undefined;
  await post.save();

  logger.info(`[ApprovalService] Post ${post._id} rejected. Reason: ${rejectionReason}`);

  // Notify the system admin that a post was rejected
  try {
    await sendMail({
      to: envConfig.socialApprovalEmail,
      subject: `[Post Rejected] ${post.platforms?.join('/')} post rejected`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px">
          <h2 style="color:#c82333">Post Rejected</h2>
          <p>The following AI post was rejected and will not be published.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="font-weight:700;padding:6px 0;width:120px">Post ID</td><td>${post._id}</td></tr>
            <tr><td style="font-weight:700;padding:6px 0">Topic</td><td>${post.topic || 'N/A'}</td></tr>
            <tr><td style="font-weight:700;padding:6px 0">Platforms</td><td>${post.platforms?.join(', ')}</td></tr>
            <tr><td style="font-weight:700;padding:6px 0">Scheduled</td><td>${post.scheduledAt}</td></tr>
            <tr><td style="font-weight:700;padding:6px 0">Reason</td><td>${rejectionReason}</td></tr>
          </table>
          <p style="color:#666;font-size:13px">You can view all posts in the dashboard.</p>
        </div>
      `,
      text: `Post ${post._id} was rejected. Reason: ${rejectionReason}`,
    });
  } catch (mailErr: any) {
    logger.warn(`[ApprovalService] Could not send rejection notification: ${mailErr.message}`);
  }

  return {
    post,
    html: buildResultHtml(false, 'Post Rejected', 'The post has been rejected and will not be published. A notification has been sent.'),
  };
};
