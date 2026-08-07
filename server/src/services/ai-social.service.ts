import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.util';
import { envConfig } from '../config/env.config';
import { findShortFormNoveltyCollision } from './short-form-novelty.util';

export interface GeneratedPost {
  title: string;
  caption: string;
  content?: string;
  hashtags: string[];
  mediaUrl?: string;
  mediaUrls?: string[];
  platformSpecificContent?: Record<string, any>;
  generationBrief?: Record<string, any> | null;
  instagramHtml?: string;
  additionalInformation?: Record<string, any> | null;
}

type ShortFormPlatform = 'facebook' | 'instagram' | 'linkedin';

interface ShortFormVideoContent {
  duration_seconds: number;
  title: string;
  hook: string;
  script: string;
  thumbnail_text: string;
  thumbnail_concept: string;
  hashtags: string[];
  presentation?: {
    replace_fallback: boolean;
    title?: string;
    sections?: Array<{ key?: string; label?: string; content?: string }>;
    structure?: string[];
    word_count?: { min?: number; max?: number } | null;
    duration_source?: 'explicit' | 'fallback';
    word_count_source?: 'explicit' | 'duration_derived' | 'fallback';
    timeline?: Array<{
      label?: string;
      start_seconds?: number;
      end_seconds?: number;
      timestamp?: string;
      word_min?: number;
      word_max?: number;
    }>;
  };
}

export interface ContentNoveltyItem {
  title?: string;
  selectedFocus?: string;
  summary?: string;
  contentExcerpt?: string;
  shortFormVideos?: Array<{
    platform: ShortFormPlatform;
    title?: string;
    hook?: string;
    scriptExcerpt?: string;
    scriptEnding?: string;
    thumbnailText?: string;
    hashtags?: string[];
  }>;
  scheduledAt?: string;
  createdAt?: string;
}

export interface GeneratePostContentOptions {
  noveltyHistory?: ContentNoveltyItem[];
}

const buildPublicUploadUrl = (fileName: string) => {
  const apiPrefix = envConfig.apiPrefix.replace(/\/+$/, '');
  return `${apiPrefix}/uploads/SocialMediaAutomation/generatedImages/${fileName}`;
};

const getMediaFileName = (mediaUrl: string) => {
  try {
    return path.basename(new URL(mediaUrl).pathname);
  } catch {
    return path.basename(mediaUrl.split('?')[0]);
  }
};

const asArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value];
  }

  return [];
};

const getGeneratedImageUrls = (result: Record<string, any>): string[] => {
  const candidates = [
    result.instagram_images,
    result.instagramImages,
    result.media_urls,
    result.mediaUrls,
    result.instagram_image,
    result.instagramImage,
    result.media_url,
    result.mediaUrl,
  ];

  return Array.from(new Set(candidates.flatMap(asArray)));
};

const normalizeShortFormVideo = (value: any): ShortFormVideoContent | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  const script = typeof value.script === 'string' ? value.script.trim() : '';
  const hook = typeof value.hook === 'string' ? value.hook.trim() : '';
  const thumbnailText = typeof value.thumbnail_text === 'string'
    ? value.thumbnail_text.trim()
    : typeof value.thumbnailText === 'string'
      ? value.thumbnailText.trim()
      : '';
  const thumbnailConcept = typeof value.thumbnail_concept === 'string'
    ? value.thumbnail_concept.trim()
    : typeof value.thumbnailConcept === 'string'
      ? value.thumbnailConcept.trim()
      : '';

  const presentation = value.presentation && typeof value.presentation === 'object'
    ? value.presentation
    : undefined;

  if (!script && !hook && !thumbnailText && !thumbnailConcept && !presentation) return undefined;

  return {
    ...value,
    duration_seconds: Number(value.duration_seconds || value.durationSeconds || 60),
    title: typeof value.title === 'string' ? value.title : 'Short-form video script',
    hook,
    script,
    thumbnail_text: thumbnailText,
    thumbnail_concept: thumbnailConcept,
    hashtags: asArray(value.hashtags),
    presentation,
  };
};

const enrichShortFormVideoContent = (
  platformSpecificContent: Record<string, any> | undefined,
) => {
  const enriched = { ...(platformSpecificContent || {}) };

  for (const [platform, platformContent] of Object.entries(enriched)) {
    if (!platformContent || typeof platformContent !== 'object') continue;
    const existing = platformContent as Record<string, any>;
    const providedVideo = normalizeShortFormVideo(existing.shortFormVideo || existing.short_form_video);

    enriched[platform] = {
      ...existing,
      ...(providedVideo ? { shortFormVideo: providedVideo } : {}),
    };
    delete enriched[platform].short_form_video;
  }

  return enriched;
};

export const generatePostContent = async (
  category: string,
  interests: string[],
  tone: string,
  targetAudience?: string,
  options: GeneratePostContentOptions = {}
): Promise<GeneratedPost> => {
  const topic = interests.length > 0 ? interests[0] : category;
  const audience = targetAudience?.trim() || 'Business and LinkedIn readers';
  const noveltyHistory = options.noveltyHistory?.slice(0, 20) || [];
  const aiNoveltyHistory = noveltyHistory.map((item) => ({
    ...item,
    shortFormVideos: item.shortFormVideos?.map((video) => ({
      platform: video.platform,
      title: video.title,
      hook: video.hook,
      scriptEnding: video.scriptEnding,
      thumbnailText: video.thumbnailText,
      hashtags: video.hashtags,
    })),
  }));
  logger.info(
    `Generating real AI content for topic: ${topic}, tone: ${tone}, audience: ${audience}, previousItems: ${noveltyHistory.length}`,
  );

  try {
    let result: Record<string, any> | undefined;
    let rejectedCandidate: Record<string, any> | undefined;
    const maxNoveltyAttempts = noveltyHistory.length ? 2 : 1;

    for (let attempt = 1; attempt <= maxNoveltyAttempts; attempt += 1) {
      const response = await axios.post(`${envConfig.crewaiApiUrl}/content/generate`, {
        topic,
        crew_type: 'content',
        tone,
        audience,
        metadata: {
          openaiWebSearchNews: {
            enabled: true,
            lookbackHours: 24,
            searchContextSize: 'high',
          },
          contentNovelty: {
            previousItems: aiNoveltyHistory,
            rejectedCandidate,
          },
        },
      }, {
        timeout: 600000,
      });

      result = response.data;
      if (result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to generate content from AI backend');
      }

      const collision = findShortFormNoveltyCollision(result.platform_specific_content, noveltyHistory);
      if (!collision) break;

      logger.warn('Rejected repetitive short-form content.', {
        topic,
        platform: collision.platform,
        similarity: Number(collision.similarity.toFixed(3)),
        attempt,
      });
      if (attempt === maxNoveltyAttempts) {
        throw new Error(`AI short-form novelty check failed for ${collision.platform}; generated content was too similar to recent history.`);
      }
      rejectedCandidate = collision;
    }

    if (!result) throw new Error('AI backend returned no content.');

    const djangoBaseUrl = envConfig.crewaiApiUrl.replace(/\/api\/v1\/?$/, '');
    const instagramImages = getGeneratedImageUrls(result);
    const localMediaUrls: string[] = [];

    if (instagramImages.length === 0) {
      logger.warn('AI backend returned no generated image URLs for social content.', {
        topic,
        requestId: result.request_id,
        hasInstagramSlides: Array.isArray(result.instagram_slides) && result.instagram_slides.length > 0,
      });
    }

    for (const mediaUrl of instagramImages) {
      if (mediaUrl) {
        const djangoUrl = mediaUrl.startsWith('http') ? mediaUrl : `${djangoBaseUrl}/media/${mediaUrl}`;

        try {
          // Download and save locally to Node server
          const generatedDir = path.join(process.cwd(), envConfig.uploadRootDir, 'SocialMediaAutomation', 'generatedImages');
          if (!fs.existsSync(generatedDir)) {
            fs.mkdirSync(generatedDir, { recursive: true });
          }

          const fileName = `${Date.now()}-${getMediaFileName(djangoUrl)}`;
          const localPath = path.join(generatedDir, fileName);

          // Try filesystem copy first since they run on the same local environment!
          const relativeMediaPart = mediaUrl.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/media\//, '').replace(/^\/+/, '');
          const candidatePaths = [
            path.resolve(__dirname, '../../../AgenticServer/media', relativeMediaPart),
            path.resolve(process.cwd(), '../AgenticServer/media', relativeMediaPart),
            path.resolve(process.cwd(), 'AgenticServer/media', relativeMediaPart),
            path.join('/home/jayeesha/AI_TEMPLATE_AI/media', relativeMediaPart),
            path.join('/var/www/aitemplate.dosystemsinc.com/AgenticServer/media', relativeMediaPart)
          ];

          let copiedLocally = false;
          for (const localDjangoFilePath of candidatePaths) {
            if (fs.existsSync(localDjangoFilePath)) {
              logger.info(`Copying AI image directly from local filesystem: ${localDjangoFilePath} to ${localPath}`);
              fs.copyFileSync(localDjangoFilePath, localPath);
              copiedLocally = true;
              break;
            }
          }

          if (!copiedLocally) {
            logger.info(`Downloading AI image from ${djangoUrl} to ${localPath}`);
            const imageResponse = await axios.get(djangoUrl, { responseType: 'stream' });
            const writer = fs.createWriteStream(localPath);
            imageResponse.data.pipe(writer);

            await new Promise<void>((resolve, reject) => {
              writer.on('finish', () => resolve());
              writer.on('error', reject);
            });
          }

          localMediaUrls.push(buildPublicUploadUrl(fileName));
        } catch (downloadError: any) {
          logger.error(`Failed to download AI image: ${downloadError.message}`);
          localMediaUrls.push(djangoUrl);
        }
      }
    }

    const platformSpecificContent = enrichShortFormVideoContent(result.platform_specific_content);

    return {
      title: result.title || `Post about ${topic}`,
      content: result.final_content || result.content,
      caption: result.final_content || result.content, // Fallback for legacy
      hashtags: result.hashtags || [],
      mediaUrl: localMediaUrls[0],
      mediaUrls: localMediaUrls,
      platformSpecificContent,
      instagramHtml: result.instagram_html,
      additionalInformation: result.additional_information || result.additionalInformation || null,
      generationBrief: result.generation_brief || result.generationBrief || null,
    };
  } catch (error: any) {
    logger.error(`Error calling AI backend: ${error.message}`);
    throw new Error(`AI Generation failed: ${error.message}`);
  }
};
