import { ExpenseEvent } from './expenseEvent.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

export const expenseEventService = {
  async create(data: any) {
    return ExpenseEvent.create({
      ...data,
      active: true,
      created: new Date(),
      updated: new Date(),
    });
  },

  async getById(id: string, locale: string) {
    const expenseEvent = await ExpenseEvent.findOne({ _id: id, active: true });
    if (!expenseEvent) {
      throw new AppError(t('expenseEvent.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return expenseEvent;
  },

  async update(id: string, data: any, locale: string) {
    data.updated = new Date();
    const expenseEvent = await ExpenseEvent.findOneAndUpdate({ _id: id, active: true }, data, { new: true });
    if (!expenseEvent) {
      throw new AppError(t('expenseEvent.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return expenseEvent;
  },

  async delete(id: string, locale: string) {
    const expenseEvent = await ExpenseEvent.findOneAndUpdate(
      { _id: id, active: true },
      { active: false, updated: new Date() },
      { new: true }
    );

    if (!expenseEvent) {
      throw new AppError(t('expenseEvent.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
