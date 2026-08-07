import { Task } from './task.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';

export const taskService = {
  async create(data: any, locale: string, createdBy: string) {
    const item = await Task.create({
      ...data,
      active: data.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await Task.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('task.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await Task.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('task.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(item, {
      ...data,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const item = await Task.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy,
        updated: new Date(),
      },
      { new: true }
    );

    if (!item) {
      throw new AppError(t('task.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
