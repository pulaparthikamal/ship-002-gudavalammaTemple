import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as postService from './post.service';
import * as socialApprovalService from '../../services/social-approval.service';
import { publishDirectToLinkedIn } from '../linkedin/linkedin.service';
import respUtil from '../../utils/resp.util';

export const getPosts = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  
  let filters: any = {};
  let page = 1;
  let limit = 20;

  if (req.query.filter) {
    try {
      const parsedFilter = JSON.parse(req.query.filter as string);
      page = parsedFilter.page || 1;
      limit = parsedFilter.limit || 20;
      
      if (parsedFilter.criteria && Array.isArray(parsedFilter.criteria)) {
        parsedFilter.criteria.forEach((c: any) => {
          if (c.key && c.value !== undefined && c.value !== null) {
            // Robust handle for automationId - ensure it's an ObjectId if it's a valid hex string
            if (c.key === 'automationId' && typeof c.value === 'string' && /^[0-9a-fA-F]{24}$/.test(c.value)) {
              filters[c.key] = new mongoose.Types.ObjectId(c.value);
            } else {
              filters[c.key] = c.value;
            }
          }
        });
      }
    } catch (e) {
      console.error('Error parsing filter query:', e);
    }
  }

  console.log(`[PostsController] Fetching posts for User: ${userId}, Filters:`, JSON.stringify(filters), `Page: ${page}, Limit: ${limit}`);

  const result = await postService.getPostsPaged(userId, filters, page, limit);
  
  console.log(`[PostsController] Found ${result.posts.length} posts out of ${result.total} total.`);

  req.entityType = 'post';
  (req as any).post = result.posts;
  (req as any).pagination = {
    page,
    limit,
    totalCount: result.total
  };
  
  return res.json(respUtil.getListSuccessResponse(req));
};

export const getScheduledPosts = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const posts = await postService.getPosts(userId, { status: 'scheduled' });
  
  req.entityType = 'post';
  (req as any).post = posts;
  
  return res.json(respUtil.getListSuccessResponse(req));
};

export const getPostedPosts = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const posts = await postService.getPosts(userId, { status: 'posted' });
  
  req.entityType = 'post';
  (req as any).post = posts;
  
  return res.json(respUtil.getListSuccessResponse(req));
};

export const createPost = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const post = await postService.createPost({ ...req.body, userId });
  req.entityType = 'post';
  (req as any).post = post;
  return res.json(respUtil.createSuccessResponse(req));
};

export const updatePost = async (req: Request, res: Response) => {
  const { id } = req.params;
  const post = await postService.updatePost(id, req.body);
  req.entityType = 'post';
  (req as any).post = post;
  return res.json(respUtil.updateSuccessResponse(req));
};

export const deletePost = async (req: Request, res: Response) => {
  const { id } = req.params;
  const post = await postService.deletePost(id);
  req.entityType = 'post';
  (req as any).post = post;
  return res.json(respUtil.removeSuccessResponse(req));
};

export const bulkDeletePosts = async (req: Request, res: Response) => {
  const { ids } = req.body;
  const result = await postService.bulkDeletePosts(ids);
  req.entityType = 'post';
  (req as any).post = { deletedCount: result.deletedCount };
  return res.json(respUtil.removeSuccessResponse(req));
};

export const sendPostNow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { pageId, platform: platformOverride } = req.body;
  const userId = (req as any).user._id;
  const post = await postService.sendPostNow(id, userId, pageId, platformOverride);
  
  const platformName = (platformOverride || (post && Array.isArray(post.platforms) && post.platforms[0]) || 'platform');
  const capitalizedPlatform = platformName.charAt(0).toUpperCase() + platformName.slice(1);

  return res.json(respUtil.dataSuccessResponse(req, post, `Post published to ${capitalizedPlatform} successfully.`));
};

export const sendLinkedInPostNow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user._id;
  const post = await postService.sendPostNow(id, userId);

  return res.json(respUtil.dataSuccessResponse(req, post, 'Post published to LinkedIn successfully.'));
};

/**
 * Direct LinkedIn publish — no Post document required.
 * Body: { type: 'text'|'image'|'video', text: string, mediaUrl?: string }
 */
export const publishLinkedIn = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const { type = 'text', text, mediaUrl } = req.body;

  const result = await publishDirectToLinkedIn({ userId, type, text, mediaUrl });

  return res.json(
    respUtil.dataSuccessResponse(
      req,
      result,
      result.success ? 'Post published to LinkedIn successfully.' : result.error
    )
  );
};

// GET /approval/:token/preview  — returns rich HTML page (email Preview button → browser)
export const getApprovalPreviewHtml = async (req: Request, res: Response) => {
  try {
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const { html } = await socialApprovalService.getApprovalPreview(req.params.token, hostUrl);
    return res.send(html);
  } catch (err: any) {
    const errorHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head>
      <body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f6f9;margin:0">
        <div style="background:#fff;border-radius:16px;padding:48px 40px;text-align:center;max-width:500px;box-shadow:0 8px 40px rgba(0,0,0,.1)">
          <div style="font-size:56px;margin-bottom:16px">⚠️</div>
          <h1 style="color:#c82333;margin:0 0 12px;font-size:22px">Preview Unavailable</h1>
          <p style="color:#64748b;font-size:15px">${err.message}</p>
          <p style="margin-top:24px;font-size:13px;color:#94a3b8">The link may have expired or already been used.</p>
        </div>
      </body></html>`;
    return res.status(404).send(errorHtml);
  }
};

// GET /approval/:token  — returns JSON data (for programmatic / frontend use)
export const getApprovalPreviewJson = async (req: Request, res: Response) => {
  const hostUrl = `${req.protocol}://${req.get('host')}`;
  const { post } = await socialApprovalService.getApprovalPreview(req.params.token, hostUrl);
  return res.json(respUtil.dataSuccessResponse(req, {
    id: post._id,
    topic: post.topic,
    content: post.content,
    platforms: post.platforms,
    scheduledAt: post.scheduledAt,
    approvalStatus: post.approvalStatus,
    platformSpecificContent: post.platformSpecificContent,
    additionalInformation: post.additionalInformation,
  }, 'Approval preview loaded successfully.'));
};

// Keep old name for backward compat
export const getApprovalPreview = getApprovalPreviewJson;

// JSON POST route — used by frontend approval page
export const approvePost = async (req: Request, res: Response) => {
  const { post } = await socialApprovalService.approvePost(req.params.token, req.body?.approvedByEmail);
  return res.json(respUtil.dataSuccessResponse(req, post, 'AI social media post approved successfully.'));
};

// JSON POST route — used by frontend approval page
export const rejectPost = async (req: Request, res: Response) => {
  const { post } = await socialApprovalService.rejectPost(req.params.token, req.body?.reason);
  return res.json(respUtil.dataSuccessResponse(req, post, 'AI social media post rejected successfully.'));
};

// Fix #2: GET handler for email link clicks — returns HTML page in browser
export const approvePostViaEmail = async (req: Request, res: Response) => {
  try {
    const { html } = await socialApprovalService.approvePost(req.params.token);
    return res.send(html);
  } catch (err: any) {
    const errorHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f6f9;margin:0">
        <div style="background:#fff;border-radius:16px;padding:48px 40px;text-align:center;max-width:480px;box-shadow:0 8px 40px rgba(0,0,0,.1)">
          <div style="font-size:56px;margin-bottom:16px">⚠️</div>
          <h1 style="color:#c82333;margin:0 0 12px">Approval Failed</h1>
          <p style="color:#64748b;font-size:15px">${err.message}</p>
        </div>
      </body></html>`;
    return res.status(400).send(errorHtml);
  }
};

// Fix #2: GET handler for email link clicks — returns HTML page in browser
export const rejectPostViaEmail = async (req: Request, res: Response) => {
  try {
    const reason = (req.query.reason as string) || undefined;
    const { html } = await socialApprovalService.rejectPost(req.params.token, reason);
    return res.send(html);
  } catch (err: any) {
    const errorHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f6f9;margin:0">
        <div style="background:#fff;border-radius:16px;padding:48px 40px;text-align:center;max-width:480px;box-shadow:0 8px 40px rgba(0,0,0,.1)">
          <div style="font-size:56px;margin-bottom:16px">⚠️</div>
          <h1 style="color:#c82333;margin:0 0 12px">Rejection Failed</h1>
          <p style="color:#64748b;font-size:15px">${err.message}</p>
        </div>
      </body></html>`;
    return res.status(400).send(errorHtml);
  }
};

export const sendApprovalEmail = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const post = await socialApprovalService.requestApprovalEmailForPost(req.params.id, userId);
  return res.json(respUtil.dataSuccessResponse(req, post, 'Approval email sent successfully.'));
};

// ─── Bulk approve/reject by post ID (auth-protected, no token needed) ────────
import { Post } from './post.model';
import { envConfig } from '../../config/env.config';

export const bulkApproveById = async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!ids?.length) return res.json(respUtil.dataSuccessResponse(req, { updated: 0 }, 'No IDs provided.'));

  const results: { id: string; status: string; message: string }[] = [];

  for (const id of ids) {
    try {
      const post = await Post.findById(id);
      if (!post) { results.push({ id, status: 'error', message: 'Not found' }); continue; }
      if (post.approvalStatus === 'approved') { results.push({ id, status: 'skipped', message: 'Already approved' }); continue; }

      post.approvalStatus = 'approved';
      post.status = post.postingMode === 'now' ? 'pending' : 'scheduled';
      post.approvedAt = new Date();
      post.approvedByEmail = (req as any).user?.email || envConfig.socialApprovalEmail;
      post.approvalToken = undefined;
      post.rejectionReason = undefined;
      (post as any).rejectedAt = undefined;
      await post.save();
      results.push({ id, status: 'approved', message: 'Approved' });
    } catch (e: any) {
      results.push({ id, status: 'error', message: e.message });
    }
  }

  return res.json(respUtil.dataSuccessResponse(req, { results, updated: results.filter(r => r.status === 'approved').length }, 'Bulk approve complete.'));
};

export const bulkRejectById = async (req: Request, res: Response) => {
  const { ids, reason } = req.body as { ids: string[]; reason?: string };
  if (!ids?.length) return res.json(respUtil.dataSuccessResponse(req, { updated: 0 }, 'No IDs provided.'));

  const rejectionReason = reason || 'Rejected from dashboard';
  const results: { id: string; status: string; message: string }[] = [];

  for (const id of ids) {
    try {
      const post = await Post.findById(id);
      if (!post) { results.push({ id, status: 'error', message: 'Not found' }); continue; }
      if (post.approvalStatus === 'rejected') { results.push({ id, status: 'skipped', message: 'Already rejected' }); continue; }

      post.approvalStatus = 'rejected';
      post.status = 'failed';
      (post as any).rejectedAt = new Date();
      post.rejectionReason = rejectionReason;
      post.approvalToken = undefined;
      post.approvedAt = undefined;
      post.approvedByEmail = undefined;
      await post.save();
      results.push({ id, status: 'rejected', message: 'Rejected' });
    } catch (e: any) {
      results.push({ id, status: 'error', message: e.message });
    }
  }

  return res.json(respUtil.dataSuccessResponse(req, { results, updated: results.filter(r => r.status === 'rejected').length }, 'Bulk reject complete.'));
};
