import { Dashboard } from './dashboard.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { PaginationQuery, PaginationMeta } from '../../types/pagination.types';

export const dashboardService = {
  async create(data: any) {
    return Dashboard.create(data);
  },

  async getAll(query: PaginationQuery, skip: number, limit: number, sort: any) {
    const data = await Dashboard.find()
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Dashboard.countDocuments();
    const meta: PaginationMeta = {
      page: Number(query.page) || 1,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    return { data, meta };
  },

  async getById(id: string, locale: string) {
    const dashboard = await Dashboard.findById(id);
    if (!dashboard) {
      throw new AppError(t('common.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return dashboard;
  },

  async update(id: string, data: any, locale: string) {
    const dashboard = await Dashboard.findByIdAndUpdate(id, data, { new: true });
    if (!dashboard) {
      throw new AppError(t('common.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return dashboard;
  },

  async delete(id: string, locale: string) {
    const dashboard = await Dashboard.findByIdAndDelete(id);
    if (!dashboard) {
      throw new AppError(t('common.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },
};
