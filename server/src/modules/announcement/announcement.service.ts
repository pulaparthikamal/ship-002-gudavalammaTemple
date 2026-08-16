import { Announcement, IAnnouncement } from './announcement.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

export const announcementService = {
  async listActive() {
    const now = new Date();
    return Announcement.find({
      active: true,
      startAt: { $lte: now },
      $or: [{ endAt: null }, { endAt: { $gte: now } }],
    }).sort({ priority: -1, startAt: -1 });
  },

  async list(query: Record<string, unknown> = {}) {
    return Announcement.find(query).sort({ priority: -1, startAt: -1 });
  },

  async create(data: Partial<IAnnouncement>) {
    return Announcement.create({ ...data, created: new Date(), updated: new Date() });
  },

  async update(id: string, data: Partial<IAnnouncement>, locale: string) {
    const announcement = await Announcement.findOneAndUpdate(
      { _id: id },
      { ...data, updated: new Date() },
      { new: true }
    );
    if (!announcement) {
      throw new AppError(t('announcement.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return announcement;
  },

  async delete(id: string, locale: string) {
    const announcement = await Announcement.findOneAndUpdate(
      { _id: id },
      { active: false, updated: new Date() },
      { new: true }
    );
    if (!announcement) {
      throw new AppError(t('announcement.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },
};
