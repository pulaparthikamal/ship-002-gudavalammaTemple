import { Facility, IFacility } from './facility.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

const DEFAULT_FACILITIES: Array<Pick<IFacility, 'slug' | 'name' | 'description'>> = [
  { slug: 'cloak', name: 'Cloak Room & Locker', description: 'Safe storage for footwear & belongings' },
  { slug: 'wheelchair', name: 'Wheelchair & Palki Seva', description: 'Free assistance for elderly & disabled devotees' },
  { slug: 'annadanam', name: 'Annadanam', description: 'Free meals served daily 11 AM – 3 PM' },
  { slug: 'medical', name: 'Medical Aid Center', description: '24/7 first-aid & emergency care' },
  { slug: 'parking', name: 'Parking & E-Buggy', description: 'Vehicle parking with free e-buggy shuttle' },
  { slug: 'helpdesk', name: 'Multilingual Help Desk', description: 'Assistance in Telugu, Hindi & English' },
  { slug: 'lostfound', name: 'Lost & Found', description: 'Report or claim misplaced items' },
  { slug: 'restrooms', name: 'Rest Rooms & Dormitory', description: 'Clean rest areas for pilgrims' },
  { slug: 'wifi', name: 'Free Wi-Fi Zones', description: 'Connectivity across the temple complex' },
  { slug: 'cctv', name: 'CCTV & Safety Grid', description: 'Round the clock surveillance & security' },
  { slug: 'senior', name: 'Senior Citizen Priority', description: 'Dedicated fast-track darshan queue' },
  { slug: 'footwear', name: 'Footwear Counter', description: 'Free footwear stand at all entry gates' },
];

export const facilityService = {
  async list() {
    const count = await Facility.countDocuments();
    if (count === 0) {
      await Facility.insertMany(
        DEFAULT_FACILITIES.map((facility) => ({ ...facility, active: true, created: new Date(), updated: new Date() }))
      );
    }
    return Facility.find({ active: true }).sort({ created: 1 });
  },

  async listAll(query: Record<string, unknown> = {}) {
    return Facility.find(query).sort({ created: 1 });
  },

  async create(data: Partial<IFacility>) {
    return Facility.create({ ...data, created: new Date(), updated: new Date() });
  },

  async update(id: string, data: Partial<IFacility>, locale: string) {
    const facility = await Facility.findOneAndUpdate(
      { _id: id },
      { ...data, updated: new Date() },
      { new: true }
    );
    if (!facility) {
      throw new AppError(t('facility.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return facility;
  },

  async delete(id: string, locale: string) {
    const facility = await Facility.findOneAndUpdate(
      { _id: id },
      { active: false, updated: new Date() },
      { new: true }
    );
    if (!facility) {
      throw new AppError(t('facility.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },
};
