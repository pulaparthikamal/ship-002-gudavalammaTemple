import { Post } from '../modules/posts/post.model';
import { ContentNoveltyItem } from './ai-social.service';

interface NoveltyPost {
  topic?: string;
  title?: string;
  sourceTopic?: string;
  content?: string;
  scheduledAt?: string;
  createdAt?: Date;
  platformSpecificContent?: {
    selected_focus?: string;
    youtube?: {
      title?: string;
      video_angle?: string;
    };
    linkedin?: {
      content?: string;
      shortFormVideo?: NoveltyShortFormVideo;
    };
    instagram?: {
      caption?: string;
      shortFormVideo?: NoveltyShortFormVideo;
    };
    facebook?: {
      caption?: string;
      shortFormVideo?: NoveltyShortFormVideo;
    };
  };
}

interface NoveltyShortFormVideo {
  title?: string;
  hook?: string;
  script?: string;
  thumbnail_text?: string;
  hashtags?: string[];
}

interface TopicNoveltyHistoryParams {
  topic: string;
  userId?: unknown;
  targetAudience?: string;
  limit?: number;
}

const compactText = (value: unknown, maxLength = 700) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

export async function getTopicNoveltyHistory({
  topic,
  userId,
  targetAudience,
  limit = 12,
}: TopicNoveltyHistoryParams): Promise<ContentNoveltyItem[]> {
  const topicText = compactText(topic, 1500);
  if (!topicText) return [];

  const query: Record<string, unknown> = {
    content: { $exists: true, $ne: '' },
    $or: [
      { sourceTopic: topicText },
      { topic: topicText },
      { title: topicText },
      { 'platformSpecificContent.youtube.title': topicText },
    ],
  };

  if (userId) query.userId = userId;
  if (targetAudience?.trim()) query.targetAudience = targetAudience.trim();

  const previousPosts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select({
      topic: 1,
      title: 1,
      sourceTopic: 1,
      content: 1,
      scheduledAt: 1,
      createdAt: 1,
      'platformSpecificContent.youtube.title': 1,
      'platformSpecificContent.youtube.video_angle': 1,
      'platformSpecificContent.linkedin.content': 1,
      'platformSpecificContent.instagram.caption': 1,
      'platformSpecificContent.facebook.caption': 1,
      'platformSpecificContent.linkedin.shortFormVideo': 1,
      'platformSpecificContent.instagram.shortFormVideo': 1,
      'platformSpecificContent.facebook.shortFormVideo': 1,
    })
    .lean<NoveltyPost[]>();

  return previousPosts.map((post) => {
    const youtube = post.platformSpecificContent?.youtube;
    const linkedinContent = post.platformSpecificContent?.linkedin?.content;
    const instagramCaption = post.platformSpecificContent?.instagram?.caption;
    const facebookCaption = post.platformSpecificContent?.facebook?.caption;
    const bestContent = post.content || linkedinContent || instagramCaption || facebookCaption;
    const shortFormVideos = (['instagram', 'facebook', 'linkedin'] as const).flatMap((platform) => {
      const video = post.platformSpecificContent?.[platform]?.shortFormVideo;
      if (!video) return [];
      const script = compactText(video.script, 1200);
      return [{
        platform,
        title: compactText(video.title, 160),
        hook: compactText(video.hook, 280),
        scriptExcerpt: script.slice(0, 800),
        scriptEnding: script.slice(-320),
        thumbnailText: compactText(video.thumbnail_text, 80),
        hashtags: Array.isArray(video.hashtags) ? video.hashtags.slice(0, 12) : [],
      }];
    });

    return {
      title: compactText(post.title || youtube?.title || post.topic, 160),
      selectedFocus: compactText(youtube?.video_angle || post.platformSpecificContent?.selected_focus, 220),
      summary: compactText(bestContent, 300),
      contentExcerpt: compactText(bestContent, 700),
      shortFormVideos,
      scheduledAt: post.scheduledAt,
      createdAt: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
    };
  });
}
