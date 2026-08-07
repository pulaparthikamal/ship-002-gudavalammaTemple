import cron from 'node-cron';
import axios from 'axios';
import { ScheduledPost } from '../modules/facebook/scheduledPost.model';
import { FacebookToken } from '../modules/facebook/facebook.model';
import { Post } from '../modules/posts/post.model';
import { sendPostNow } from '../modules/posts/post.service';
import { logger } from '../utils/logger.util';

const processingPostIds = new Set<string>();

export const startSocialCron = () => {
  // Run every minute so "Schedule For" posts are published close to their selected time.
  cron.schedule('* * * * *', async () => {
    // logger.debug('Running Social Media Cron Job...');

    try {
      const now = new Date();
      await processDueSocialPosts(now);
      await processDueScheduledPosts(now);
    } catch (error) {
      logger.error('Error in Social Media Cron Job:', error);
    }
  });
};

// ─── Fix #4: compare scheduledAt correctly regardless of ISO vs local string ───
const processDueSocialPosts = async (now: Date) => {
  // Pull all scheduled+approved posts and filter in JS to handle both
  // ISO UTC strings ("2026-05-12T04:30:00.000Z") and local strings ("2026-05-12T10:00")
  const duePosts = await Post.find({
    status: 'scheduled',
    $and: [
      {
        $or: [
          { postType: { $ne: 'ai' } },
          { postType: 'ai', approvalStatus: 'approved' },
        ],
      },
    ],
  });

  // Filter: parse scheduledAt as a Date and compare to now
  const pastDue = duePosts.filter((post) => {
    if (!post.scheduledAt) return false;
    const scheduledDate = new Date(post.scheduledAt);
    return !isNaN(scheduledDate.getTime()) && scheduledDate <= now;
  });

  if (!pastDue.length) return;

  logger.info(`[SocialCron] Found ${pastDue.length} scheduled post(s) due for publishing`);

  for (const post of pastDue) {
    const postId = String(post._id);
    if (processingPostIds.has(postId)) continue;

    processingPostIds.add(postId);

    try {
      await sendPostNow(postId, post.userId);
      logger.info(`[SocialCron] ✓ Published post ${post._id}`);
    } catch (error: any) {
      logger.error(`[SocialCron] ✗ Failed to publish post ${post._id}: ${error.message}`);
      // Mark as failed so cron doesn't retry indefinitely
      await Post.findByIdAndUpdate(postId, { status: 'failed', errorMessage: error.message });
    } finally {
      processingPostIds.delete(postId);
    }
  }
};

// ─── Legacy ScheduledPost model (Facebook only) ───────────────────────────────
const processDueScheduledPosts = async (now: Date) => {
  const pendingPosts = await ScheduledPost.find({ status: 'pending' });
  const pastDue = pendingPosts.filter((post: any) => {
    if (!post.scheduledAt) return false;
    return new Date(post.scheduledAt) <= now;
  });

  if (!pastDue.length) return;

  logger.info(`[SocialCron] Found ${pastDue.length} legacy scheduled post(s)`);

  for (const post of pastDue) {
    try {
      if (post.platform === 'facebook') {
        await handleFacebookPost(post);
      }
      post.status = 'posted';
      await post.save();
    } catch (error: any) {
      logger.error(`[SocialCron] ✗ Failed legacy post ${post._id}: ${error.message}`);
      post.status = 'failed';
      post.errorMessage = error.response?.data?.error?.message || error.message;
      await post.save();
    }
  }
};

const handleFacebookPost = async (post: any) => {
  const fbToken = await FacebookToken.findOne({ user: post.user });
  if (!fbToken) throw new Error('Facebook account not connected');

  const page = post.fbPageId
    ? fbToken.pages.find((p: any) => p.pageId === post.fbPageId)
    : fbToken.pages.find((p: any) => p.isActive);

  if (!page) throw new Error('No active Facebook page found');

  await axios.post(`https://graph.facebook.com/v19.0/${page.pageId}/feed`, {
    message: post.content,
    access_token: page.pageAccessToken,
  });
};
