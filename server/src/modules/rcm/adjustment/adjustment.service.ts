import { Adjustment } from './adjustment.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';

export const adjustmentService = {
  async create(data: any, locale: string, createdBy: string): Promise<any> {
    throw new AppError('Adjustments are generated only through controlled ERA, reversal, or write-off workflows.', HTTP_STATUS.BAD_REQUEST);
  },

  async getById(id: string, locale: string) {
    const item = await Adjustment.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('adjustment.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    throw new AppError('Adjustments are append-only. Create a controlled reversal instead.', HTTP_STATUS.BAD_REQUEST);
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    throw new AppError('Adjustments are append-only and cannot be deleted. Create a controlled reversal instead.', HTTP_STATUS.BAD_REQUEST);
  },
};
