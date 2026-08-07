import { Token } from './token.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { PaginationQuery, PaginationMeta } from '../../types/pagination.types';

export const tokenService = {
  async list(query: PaginationQuery, skip: number, limit: number, sort: any) {
    const filter = {}; // You can add global/table search later if needed

    const data = await Token.find(filter)
      .populate('user', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Token.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const meta: PaginationMeta = {
      page: Number(query.page) || 1,
      limit,
      total,
      totalPages,
    };

    return { data, meta };
  },

  async toggleStatus(id: string, isValid: boolean, locale: string) {
    const token = await Token.findByIdAndUpdate(
      id,
      { isValid },
      { new: true }
    );

    if (!token) {
      throw new AppError(t('token.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return token;
  },

  async delete(id: string, locale: string) {
    const token = await Token.findById(id);
    if (!token) {
      throw new AppError(t('token.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    await Token.findByIdAndDelete(id);
    return true;
  },
};
