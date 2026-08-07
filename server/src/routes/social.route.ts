import { Router } from 'express';
import automationRoutes from '../modules/social-automation/automation.route';
import categoryRoutes from '../modules/categories/category.route';
import socialAccountRoutes from '../modules/social-accounts/socialAccount.route';
import postRoutes from '../modules/posts/post.route';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler.util';

const router = Router();

router.use('/automation', automationRoutes);
router.use('/categories', categoryRoutes);
router.use('/connect', socialAccountRoutes); // social/connect/:platform is handled inside socialAccountRoutes
router.use('/accounts', socialAccountRoutes); // social/accounts is handled inside socialAccountRoutes
router.use('/posts', postRoutes);

router.post('/generate', async (req, res) => {
  const { category, interests = [], tone, targetAudience, postType, postingMode, platforms, scheduledAt, userId } = req.body;
  const { generatePostContent } = await import('../services/ai-social.service');
  const { createPost } = await import('../modules/posts/post.service');
  const { getTopicNoveltyHistory } = await import('../services/content-novelty.service');
  const { requestApprovalEmailForPost } = await import('../services/social-approval.service');
  const topic = Array.isArray(interests) && interests.length > 0 ? interests[0] : category;
  const noveltyHistory = await getTopicNoveltyHistory({ topic, userId, targetAudience });
  const content = await generatePostContent(category, interests, tone, targetAudience, { noveltyHistory });

  const normalizedPostType = String(postType || '').toLowerCase();
  const shouldCreateAiPost = normalizedPostType === 'ai' && userId && Array.isArray(platforms) && platforms.length && scheduledAt;

  if (!shouldCreateAiPost) {
    return res.json({ success: true, data: content });
  }

  const post = await createPost({
    userId,
    postType: 'ai',
    postingMode: postingMode === 'now' ? 'now' : 'schedule',
    title: content.title,
    sourceTopic: topic,
    topic: content.title,
    targetAudience,
    content: `${content.title}\n\n${content.caption}\n\n${content.hashtags.join(' ')}`.trim(),
    mediaUrl: content.mediaUrl,
    mediaUrls: content.mediaUrls || (content.mediaUrl ? [content.mediaUrl] : []),
    platforms,
    scheduledAt,
    platformSpecificContent: content.platformSpecificContent,
    additionalInformation: content.additionalInformation,
    generationBrief: content.generationBrief,
    instagramHtml: content.instagramHtml,
  });
  await requestApprovalEmailForPost(String(post._id), String(userId));

  return res.json({ success: true, data: content, post });
});

// ─── DEV ONLY: Manually trigger the automation seed cron ───────────────────
router.post('/dev/trigger-seed', authMiddleware, asyncHandler(async (req, res) => {
  const { Automation } = await import('../modules/social-automation/automation.model');
  const { Post } = await import('../modules/posts/post.model');
  const { generatePostContent } = await import('../services/ai-social.service');
  const { getTopicNoveltyHistory } = await import('../services/content-novelty.service');
  const { createApprovalToken, sendSocialApprovalEmail } = await import('../services/social-approval.service');
  const { logger } = await import('../utils/logger.util');

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000); // next 1 hour

  const automations = await Automation.find({ isActive: true, isDeleted: false }).populate('categoryId');
  const relevant = automations.filter((a: any) => {
    if (a.startDate && new Date(a.startDate) > windowEnd) return false;
    if (a.endDate && new Date(a.endDate) < now) return false;
    return true;
  });

  let totalSeeded = 0;
  const details: any[] = [];

  for (const automation of relevant as any[]) {
    const category = (automation.categoryId as any)?.name || 'General';
    const topic = automation.interests?.[0] || category;
    const intervalMs = automation.frequency === '5min' ? 5 * 60 * 1000 : 10 * 60 * 1000;
    const startMs = Math.ceil(now.getTime() / intervalMs) * intervalMs;
    const slots: Date[] = [];
    for (let t = startMs; t <= windowEnd.getTime(); t += intervalMs) slots.push(new Date(t));

    for (const slot of slots) {
      const scheduledStr = slot.toISOString();
      const existing = await Post.findOne({ automationId: automation._id, scheduledAt: scheduledStr });
      if (existing) continue;

      try {
        const noveltyHistory = await getTopicNoveltyHistory({
          topic,
          userId: automation.userId,
          targetAudience: automation.targetAudience,
        });
        const generated = await generatePostContent(
          category,
          automation.interests || [],
          automation.tone || 'humanic',
          automation.targetAudience,
          { noveltyHistory },
        );
        const approvalToken = createApprovalToken();
        const post = await Post.create({
          userId: automation.userId,
          automationId: automation._id,
          postType: 'ai',
          postingMode: 'schedule',
          title: generated.title,
          sourceTopic: topic,
          topic,
          targetAudience: automation.targetAudience,
          content: (generated as any).content || generated.caption || '',
          mediaUrl: generated.mediaUrl,
          mediaUrls: generated.mediaUrls || [],
          platformSpecificContent: generated.platformSpecificContent,
          additionalInformation: generated.additionalInformation,
          generationBrief: generated.generationBrief,
          platforms: automation.platforms,
          tone: automation.tone,
          status: 'waiting_for_approval',
          approvalStatus: 'email_sent',
          approvalToken,
          approvalRequestedAt: new Date(),
          scheduledAt: scheduledStr,
        });
        await sendSocialApprovalEmail(post);
        totalSeeded++;
        details.push({ postId: post._id, scheduledAt: scheduledStr, platform: automation.platforms });
        logger.info(`[TriggerSeed] Created post ${post._id} for slot ${scheduledStr}`);
      } catch (err: any) {
        logger.error(`[TriggerSeed] Failed slot ${scheduledStr}: ${err.message}`);
        details.push({ error: err.message, scheduledAt: scheduledStr });
      }
    }
  }

  return res.json({
    success: true,
    message: `Seeded ${totalSeeded} post(s) across ${relevant.length} automation(s)`,
    automationsFound: relevant.length,
    postsCreated: totalSeeded,
    details,
  });
}));

export default router;
