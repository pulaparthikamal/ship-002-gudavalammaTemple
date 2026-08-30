import { NavTab, NavTabKey, NavTabRole } from './navTab.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

const DEFAULT_NAV_TABS: Array<{
  key: NavTabKey;
  route: string;
  allowedRoles: NavTabRole[];
  isDefault?: boolean;
  guestLocked?: boolean;
}> = [
  { key: 'home', route: '/', allowedRoles: ['GUEST', 'USER'], isDefault: true },
  { key: 'darshan', route: '/devotee/darshan', allowedRoles: ['GUEST', 'USER'] },
  { key: 'seva', route: '/devotee/seva', allowedRoles: ['GUEST', 'USER'] },
  { key: 'accommodation', route: '/devotee/accommodation', allowedRoles: ['GUEST', 'USER'] },
  { key: 'prasadam', route: '/devotee/prasadam', allowedRoles: ['GUEST', 'USER'] },
  { key: 'donations', route: '/devotee/donations', allowedRoles: ['GUEST', 'USER'] },
  { key: 'events', route: '/devotee/events', allowedRoles: ['GUEST', 'USER'] },
  { key: 'live', route: '/devotee/live', allowedRoles: ['GUEST', 'USER'] },
  { key: 'bookings', route: '/devotee/bookings', allowedRoles: ['USER'], guestLocked: true },
  { key: 'facilities', route: '/devotee/facilities', allowedRoles: ['GUEST', 'USER'] },
  { key: 'nearbyPlaces', route: '/devotee/nearby-places', allowedRoles: ['GUEST', 'USER'] },
];

export const navTabService = {
  async seedNavTabs(): Promise<number> {
    let count = 0;
    for (const tab of DEFAULT_NAV_TABS) {
      await NavTab.findOneAndUpdate(
        { key: tab.key },
        { $setOnInsert: tab },
        { upsert: true, new: true }
      );
      count += 1;
    }
    return count;
  },

  async listAll() {
    return NavTab.find().sort({ key: 1 });
  },

  async listEnabledForRole(role: NavTabRole) {
    return NavTab.find({ allowedRoles: role }).sort({ key: 1 });
  },

  async setAllowedRoles(key: string, allowedRoles: NavTabRole[], locale: string) {
    const navTab = await NavTab.findOne({ key });
    if (!navTab) {
      throw new AppError(t('navTab.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (navTab.isDefault && (!allowedRoles.includes('GUEST') || !allowedRoles.includes('USER'))) {
      throw new AppError(t('navTab.cannotDisableHome', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }

    if (navTab.guestLocked && allowedRoles.includes('GUEST')) {
      throw new AppError(t('navTab.cannotEnableGuestForBookings', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }

    navTab.allowedRoles = allowedRoles;
    navTab.updated = new Date();
    await navTab.save();
    return navTab;
  },
};
