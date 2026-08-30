import { NearbyPlace } from './nearbyPlace.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

export const nearbyPlaceService = {
  async listActive() {
    return NearbyPlace.find({ active: true }).sort({ distanceKm: 1 });
  },

  async create(data: any) {
    return NearbyPlace.create({ ...data, active: data.active ?? true, created: new Date(), updated: new Date() });
  },

  async update(id: string, data: any, locale: string) {
    data.updated = new Date();
    const place = await NearbyPlace.findOneAndUpdate({ _id: id }, data, { new: true });
    if (!place) {
      throw new AppError(t('nearbyPlace.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return place;
  },

  async delete(id: string, locale: string) {
    const place = await NearbyPlace.findOneAndUpdate({ _id: id }, { active: false, updated: new Date() }, { new: true });
    if (!place) {
      throw new AppError(t('nearbyPlace.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },
};
