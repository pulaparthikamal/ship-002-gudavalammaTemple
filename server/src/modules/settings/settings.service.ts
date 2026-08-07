import { Settings } from './settings.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { PaginationQuery, PaginationMeta } from '../../types/pagination.types';

export const settingsService = {
  async create(data: any, locale: string) {
    const existing = await Settings.findOne({ key: data.key });
    if (existing) {
      throw new AppError(t('settings.keyExists', {}, locale), HTTP_STATUS.CONFLICT);
    }

    const setting = await Settings.create(data);
    return setting;
  },

  async list(query: PaginationQuery, skip: number, limit: number, sort: any) {
    const data = await Settings.find()
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Settings.countDocuments();
    const totalPages = Math.ceil(total / limit);

    const meta: PaginationMeta = {
      page: Number(query.page) || 1,
      limit,
      total,
      totalPages,
    };

    return { data, meta };
  },

  async getPublicSettings() {
    const data = await Settings.find({ isPublic: true });
    return data;
  },

  async getByKey(key: string, locale: string) {
    const setting = await Settings.findOne({ key });
    if (!setting) {
      throw new AppError(t('settings.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return setting;
  },

  async updateByKey(key: string, data: any, locale: string) {
    const setting = await Settings.findOne({ key });
    if (!setting) {
      throw new AppError(t('settings.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(setting, data);
    await setting.save();
    return setting;
  },

  async deleteByKey(key: string, locale: string) {
    const setting = await Settings.findOne({ key });
    if (!setting) {
      throw new AppError(t('settings.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (!setting.isEditable) {
      throw new AppError(t('settings.delete.notEditable', {}, locale), HTTP_STATUS.FORBIDDEN);
    }

    await Settings.findOneAndDelete({ key });
    return true;
  },
};
