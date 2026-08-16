import { Property, IProperty } from './property.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

export const propertyService = {
  async create(data: Partial<IProperty>) {
    return Property.create({
      ...data,
      active: true,
      created: new Date(),
      updated: new Date(),
    });
  },

  async getById(id: string, locale: string) {
    const property = await Property.findOne({ _id: id, active: true });
    if (!property) {
      throw new AppError(t('property.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return property;
  },

  async update(id: string, data: Partial<IProperty>, locale: string) {
    const property = await Property.findOneAndUpdate(
      { _id: id, active: true },
      { ...data, updated: new Date() },
      { new: true }
    );
    if (!property) {
      throw new AppError(t('property.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return property;
  },

  async delete(id: string, locale: string) {
    const property = await Property.findOneAndUpdate(
      { _id: id, active: true },
      { active: false, updated: new Date() },
      { new: true }
    );
    if (!property) {
      throw new AppError(t('property.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },
};
