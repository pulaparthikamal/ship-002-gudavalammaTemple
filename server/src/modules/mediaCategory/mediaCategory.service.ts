import { MediaCategory } from './mediaCategory.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { envConfig } from '../../config/env.config';

const defaultPlatformEnable = {
  youtube: false,
  facebook: false,
  instagram: false,
  linkedin: false,
};

function normalizePlatformKey(platform?: string | null) {
  return platform?.trim().toLowerCase().replace(/\s+/g, '') || '';
}

function mapPlatformToEnable(platform?: string | null) {
  const selectedPlatform = normalizePlatformKey(platform);
  const enable: Record<string, boolean> = { ...defaultPlatformEnable };

  if (selectedPlatform) {
    enable[selectedPlatform] = true;
  }

  return enable;
}

function normalizeTopicPayload(data: any) {
  return {
    ...data,
    enable: data.enable ?? mapPlatformToEnable(data.platform),
  };
}

export const mediaCategoryService = {
  async create(data: any, locale: string, createdBy: string) {
    const topic = await MediaCategory.create({
      ...normalizeTopicPayload(data),
      createdBy,
      created: new Date(),
      updated: new Date(),
    });

    return topic;
  },

  async getById(id: string, locale: string) {
    const topic = await MediaCategory.findOne({ _id: id, isDeleted: false });
    if (!topic) {
      throw new AppError(t('mediaCategory.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return topic;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const topic = await MediaCategory.findOne({ _id: id, isDeleted: false });

    if (!topic) {
      throw new AppError(t('mediaCategory.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(topic, normalizeTopicPayload(data));
    topic.updatedBy = updatedBy;
    topic.updated = new Date();

    await topic.save();
    return topic;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const topic = await MediaCategory.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), active: false, updatedBy, updated: new Date() },
      { new: true }
    );

    if (!topic) {
      throw new AppError(t('mediaCategory.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },

  async toggleStatus(id: string, active: boolean, locale: string, updatedBy: string) {
    const topic = await MediaCategory.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { active, updatedBy, updated: new Date() },
      { new: true }
    );

    if (!topic) {
      throw new AppError(t('mediaCategory.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return topic;
  },

  async generateContent(id: string, locale: string, updatedBy: string) {
    const topic = await MediaCategory.findOne({ _id: id, isDeleted: false });

    if (!topic) {
      throw new AppError(t('mediaCategory.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    try {
      const generationPrompt = topic.interestedTopics?.length === 1
        ? topic.interestedTopics[0]
        : topic.name;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600_000); // 10 minutes timeout

      const response = await fetch(`${envConfig.crewaiApiUrl}/content/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: generationPrompt,
          crewType: 'content',
          tone: topic.tone,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to generate content from CrewAI');
      }

      const result = await response.json();
      console.log(result)

      topic.content = result.content;
      topic.topicUrls = result.source_urls;
      topic.additionalInformation = result.additional_information || result.additionalInformation || null;
      topic.updatedBy = updatedBy;
      topic.updated = new Date();
      await topic.save();

      return topic;
    } catch (error: any) {
      throw new AppError(error.message || 'Error communicating with content generation service', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  },
};
