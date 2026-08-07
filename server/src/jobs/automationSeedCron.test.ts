jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('../modules/posts/post.model', () => ({
  Post: {
    updateOne: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));

jest.mock('../services/ai-social.service', () => ({
  generatePostContent: jest.fn(),
}));

jest.mock('../services/content-novelty.service', () => ({
  getTopicNoveltyHistory: jest.fn(),
}));

jest.mock('../services/social-approval.service', () => ({
  createApprovalToken: jest.fn(() => 'approval-token'),
  sendSocialApprovalEmail: jest.fn(),
}));

import { seedPostsForAutomation } from './automationSeedCron';
import { Post } from '../modules/posts/post.model';
import { generatePostContent } from '../services/ai-social.service';
import { getTopicNoveltyHistory } from '../services/content-novelty.service';
import { sendSocialApprovalEmail } from '../services/social-approval.service';

describe('seedPostsForAutomation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims a slot once and skips duplicate seeding for the same automation slot', async () => {
    const automation: any = {
      _id: 'automation-1',
      userId: 'user-1',
      categoryId: { name: 'Finance' },
      interests: ['Revenue cycle'],
      tone: 'humanic',
      targetAudience: 'Healthcare admins',
      platforms: ['linkedin'],
      frequency: 'fixed',
      fixedDate: '2026-07-06T00:00:00.000Z',
      time: '07:00',
    };

    (Post.updateOne as jest.Mock)
      .mockResolvedValueOnce({ upsertedCount: 1, upsertedId: 'post-1' })
      .mockResolvedValueOnce({ upsertedCount: 0 });
    (Post.findByIdAndUpdate as jest.Mock)
      .mockResolvedValueOnce({ _id: 'post-1', approvalStatus: 'content_generation_pending' })
      .mockResolvedValueOnce({ _id: 'post-1', approvalStatus: 'email_sent' });
    (Post.findOne as jest.Mock).mockResolvedValue({
      _id: 'post-1',
      approvalStatus: 'content_generation_pending',
      approvalToken: 'approval-token',
      content: '',
    });
    (Post.findOneAndDelete as jest.Mock).mockResolvedValue(null);

    (getTopicNoveltyHistory as jest.Mock).mockResolvedValue([]);
    (generatePostContent as jest.Mock).mockResolvedValue({
      title: 'RCM trend update',
      content: 'Main body content',
      caption: 'Main body content',
      hashtags: ['#RCM'],
      mediaUrl: 'image-1',
      mediaUrls: ['image-1'],
      platformSpecificContent: {
        linkedin: { content: 'LinkedIn body', hashtags: ['#RCM'] },
      },
      additionalInformation: {
        source_type: 'openai_web_search',
        raw_main_content: 'Main body content',
      },
      generationBrief: {
        provider: 'openai',
      },
      instagramHtml: '<p>slide</p>',
    });
    (sendSocialApprovalEmail as jest.Mock).mockResolvedValue(undefined);

    const windowStart = new Date('2026-07-05T18:00:00.000Z');
    const windowEnd = new Date('2026-07-06T03:00:00.000Z');

    const firstSeedCount = await seedPostsForAutomation(automation, windowStart, windowEnd);
    const secondSeedCount = await seedPostsForAutomation(automation, windowStart, windowEnd);

    expect(firstSeedCount).toBe(1);
    expect(secondSeedCount).toBe(0);
    expect(Post.updateOne).toHaveBeenCalledTimes(2);
    expect(generatePostContent).toHaveBeenCalledTimes(1);
    expect(sendSocialApprovalEmail).toHaveBeenCalledTimes(1);
  });
});
