import cron from 'node-cron';
import { Automation, IAutomation } from '../../modules/social-automation/automation.model';
import { IPost } from '../../modules/posts/post.model';
import { createPost } from '../../modules/posts/post.service';
import { requestApprovalEmailForPost } from '../../services/social-approval.service';
import { SocialAccount } from '../../modules/social-accounts/socialAccount.model';
import { generatePostContent } from '../../services/ai-social.service';
import { getTopicNoveltyHistory } from '../../services/content-novelty.service';
import { logger } from '../../utils/logger.util';
import axios from 'axios';
import moment from 'moment-timezone';

export const startSocialScheduler = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    logger.info('Running Social Media Scheduler Worker...');

    try {
      const now = moment();
      const currentDay = now.format('dddd'); // e.g. Monday
      const currentTime = now.format('HH:mm');

      // Find active automations
      const automations = await Automation.find({
        isActive: true,
        isDeleted: false,
        time: currentTime
      }).populate('categoryId');

      for (const automation of automations) {
        // Date bounds check
        if (automation.startDate && moment(automation.startDate).isAfter(now, 'day')) {
          continue; // Hasn't started yet
        }
        if (automation.endDate && moment(automation.endDate).isBefore(now, 'day')) {
          continue; // Has ended
        }

        // Check frequency
        let shouldRun = false;
        if (automation.frequency === 'daily') {
          shouldRun = true;
        } else if (automation.frequency === 'weekly') {
          if (currentDay === 'Monday') shouldRun = true;
        } else if (automation.frequency === 'custom' && automation.customDays) {
          if (automation.customDays.includes(currentDay)) shouldRun = true;
        }

        if (shouldRun) {
          await processAutomation(automation);
        }
      }
    } catch (error) {
      logger.error('Error in Social Media Scheduler Worker:', error);
    }
  });
};

const processAutomation = async (automation: IAutomation) => {
  try {
    const category = automation.categoryId as any;
    const sourceTopic = automation.interests?.[0] || category.name || 'General';
    const noveltyHistory = await getTopicNoveltyHistory({
      topic: sourceTopic,
      userId: automation.userId,
      targetAudience: automation.targetAudience,
    });
    const generatedContent = await generatePostContent(
      category.name || 'General',
      automation.interests || [],
      automation.tone || 'humanic',
      automation.targetAudience,
      { noveltyHistory },
    );

    for (const platform of automation.platforms) {
      let platformContent = `${generatedContent.title}\n\n${generatedContent.caption}\n\n${generatedContent.hashtags.join(' ')}`;
      let postTopic = generatedContent.title;

      // Use platform-specific content if available from AI
      if (generatedContent.platformSpecificContent) {
        const specific = generatedContent.platformSpecificContent[platform];
        if (specific) {
          if (platform === 'facebook') {
            platformContent = `${specific.caption}\n\n${(specific.hashtags || []).join(' ')}`;
          } else if (platform === 'instagram') {
            platformContent = `${specific.caption}\n\n${(specific.hashtags || []).join(' ')}`;
          } else if (platform === 'linkedin') {
            platformContent = `${specific.content}\n\n${(specific.hashtags || []).join(' ')}`;
          } else if (platform === 'youtube') {
            postTopic = specific.title || postTopic;
            platformContent = `DESCRIPTION:\n${specific.description}\n\nTAGS:\n${(specific.tags || []).join(', ')}`;
          } else if (platform === 'twitter') {
            platformContent = specific.content;
          }
        }
      }

      // Create AI post entry and request email approval immediately.
      const post = await createPost({
        userId: automation.userId,
        automationId: automation._id,
        postType: 'ai',
        postingMode: 'schedule',
        title: generatedContent.title,
        sourceTopic,
        content: platformContent,
        platforms: [platform],
        scheduledAt: new Date().toISOString(),
        topic: postTopic,
        targetAudience: automation.targetAudience,
        mediaUrl: generatedContent.mediaUrl,
        platformSpecificContent: generatedContent.platformSpecificContent,
        additionalInformation: generatedContent.additionalInformation,
        generationBrief: generatedContent.generationBrief,
        instagramHtml: generatedContent.instagramHtml
      });
      await requestApprovalEmailForPost(String(post._id), String(automation.userId));
    }

    automation.lastRunAt = new Date();
    await automation.save();
  } catch (error) {
    logger.error(`Error processing automation ${automation._id}:`, error);
  }
};

const sendToSocialApi = async (post: IPost) => {
  const account = await SocialAccount.findOne({
    userId: post.userId,
    platform: post.platforms?.[0],
    status: 'connected'
  });

  if (!account) {
    throw new Error(`Social account not connected for ${post.platforms?.[0]}`);
  }

  // Implementation for each platform
  if (post.platforms?.[0] === 'facebook') {
    await axios.post(`https://graph.facebook.com/v19.0/${account.platformAccountId}/feed`, {
      message: post.content,
      access_token: account.accessToken
    });
  } else if (post.platforms?.[0] === 'instagram') {
    // Instagram Graph API call placeholder
  } else if (post.platforms?.[0] === 'youtube') {
    // YouTube Data API call placeholder
  }
};
