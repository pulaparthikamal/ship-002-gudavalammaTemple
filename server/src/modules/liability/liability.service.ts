import { Liability, ILiability } from './liability.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

export const liabilityService = {
  async create(data: Partial<ILiability>) {
    return Liability.create({
      ...data,
      active: true,
      created: new Date(),
      updated: new Date(),
    });
  },

  async getById(id: string, locale: string) {
    const liability = await Liability.findOne({ _id: id, active: true });
    if (!liability) {
      throw new AppError(t('liability.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return liability;
  },

  async update(id: string, data: Partial<ILiability>, locale: string) {
    const liability = await Liability.findOneAndUpdate(
      { _id: id, active: true },
      { ...data, updated: new Date() },
      { new: true }
    );
    if (!liability) {
      throw new AppError(t('liability.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return liability;
  },

  async delete(id: string, locale: string) {
    const liability = await Liability.findOneAndUpdate(
      { _id: id, active: true },
      { active: false, updated: new Date() },
      { new: true }
    );
    if (!liability) {
      throw new AppError(t('liability.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },
};
