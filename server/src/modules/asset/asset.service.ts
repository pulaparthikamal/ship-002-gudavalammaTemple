import { Asset, IAsset } from './asset.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

export const assetService = {
  async create(data: Partial<IAsset>) {
    return Asset.create({
      ...data,
      active: true,
      created: new Date(),
      updated: new Date(),
    });
  },

  async getById(id: string, locale: string) {
    const asset = await Asset.findOne({ _id: id, active: true });
    if (!asset) {
      throw new AppError(t('asset.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return asset;
  },

  async update(id: string, data: Partial<IAsset>, locale: string) {
    const asset = await Asset.findOneAndUpdate(
      { _id: id, active: true },
      { ...data, updated: new Date() },
      { new: true }
    );
    if (!asset) {
      throw new AppError(t('asset.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return asset;
  },

  async delete(id: string, locale: string) {
    const asset = await Asset.findOneAndUpdate(
      { _id: id, active: true },
      { active: false, updated: new Date() },
      { new: true }
    );
    if (!asset) {
      throw new AppError(t('asset.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },
};
