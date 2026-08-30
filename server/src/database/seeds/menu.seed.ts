import { Menu } from '../../modules/menu/menu.model';
import { Role } from '../../modules/role/role.model';
import { RoleEnum } from '../../constants/roles.constants';
import { logger } from '../../utils/logger.util';

const defaultMenus = [
  { title: 'Dashboard', permissionKey: 'dashboard', route: '/dashboard', sequenceNo: 1, iconName: 'dashboard' },
  { title: 'Users', permissionKey: 'users', route: '/users', sequenceNo: 2, iconName: 'users' },
  { title: 'Roles', permissionKey: 'roles', route: '/roles', sequenceNo: 4, iconName: 'roles' },
  { title: 'Settings', permissionKey: 'settings', route: '/settings', sequenceNo: 5, iconName: 'settings' },
  { title: 'Menu Management', permissionKey: 'menu-management', route: '/menus', sequenceNo: 6, iconName: 'menus' },
  {
    title: 'Employee Mgmt.',
    permissionKey: 'employee-mgmt',
    route: '/employeeMgmt',
    sequenceNo: 10,
    iconName: 'building-user',
    submenu: [
      {
        name: 'Employees',
        route: '/employees',
        iconName: 'users',
        sequenceNo: 11,
        title: 'Employees',
        permissionKey: 'employees'
      }
    ]
  },
  {
    title: 'Temple Management',
    permissionKey: 'donor',
    route: '/donors',
    sequenceNo: 20,
    iconName: 'landmark',
    submenu: [
      { name: 'Donors', route: '/donors', iconName: 'users', sequenceNo: 21, title: 'Donors', permissionKey: 'donor' },
      { name: 'Properties', route: '/properties', iconName: 'building', sequenceNo: 22, title: 'Properties', permissionKey: 'property' },
      { name: 'Assets', route: '/assets', iconName: 'wallet-cards', sequenceNo: 23, title: 'Assets', permissionKey: 'asset' },
      { name: 'Liabilities', route: '/liabilities', iconName: 'receipt-text', sequenceNo: 24, title: 'Liabilities', permissionKey: 'liability' },
      { name: 'Expense Tracker', route: '/expense-tracker', iconName: 'bar-chart', sequenceNo: 25, title: 'Expense Tracker', permissionKey: 'expenseEntry' },
      { name: 'Seva Catalog', route: '/seva-catalog', iconName: 'clipboard-list', sequenceNo: 26, title: 'Seva Catalog', permissionKey: 'seva' },
      { name: 'Darshan Quotas', route: '/darshan-quotas', iconName: 'calendar', sequenceNo: 27, title: 'Darshan Quotas', permissionKey: 'darshan' },
      { name: 'Accommodation', route: '/accommodation-room-types', iconName: 'building-2', sequenceNo: 28, title: 'Accommodation', permissionKey: 'accommodationRoomType' },
      { name: 'Prasadam', route: '/prasadam-items', iconName: 'folder-open', sequenceNo: 29, title: 'Prasadam', permissionKey: 'prasadamItem' },
      { name: 'Donation Funds', route: '/donation-funds', iconName: 'hand-coins', sequenceNo: 30, title: 'Donation Funds', permissionKey: 'donationFund' },
      { name: 'Facilities', route: '/facilities-admin', iconName: 'facility', sequenceNo: 31, title: 'Facilities', permissionKey: 'facility' },
      { name: 'Announcements', route: '/announcements', iconName: 'megaphone', sequenceNo: 32, title: 'Announcements', permissionKey: 'announcement' },
      { name: 'Temple Profile', route: '/temple-profile', iconName: 'landmark', sequenceNo: 33, title: 'Temple Profile', permissionKey: 'templeProfile' },
      { name: 'Languages', route: '/languages', iconName: 'link', sequenceNo: 34, title: 'Languages', permissionKey: 'language' },
      { name: 'Screen Customizer', route: '/screen-builder', iconName: 'layout-dashboard', sequenceNo: 35, title: 'Screen Customizer', permissionKey: 'pageContent' },
      { name: 'Events', route: '/events', iconName: 'calendar', sequenceNo: 36, title: 'Events', permissionKey: 'templeEvent' },
      { name: 'Donations', route: '/staff-donations', iconName: 'receipt', sequenceNo: 37, title: 'Donations', permissionKey: 'donation' },
      { name: 'Bookings', route: '/staff-bookings', iconName: 'history', sequenceNo: 38, title: 'Bookings', permissionKey: 'bookingLedger' },
      { name: 'Nearby Places', route: '/nearby-places', iconName: 'compass', sequenceNo: 39, title: 'Nearby Places', permissionKey: 'nearbyPlace' },
      { name: 'Reconfigure Temple', route: '/reconfigure-temple', iconName: 'wand', sequenceNo: 40, title: 'Reconfigure Temple', permissionKey: 'templeReconfigure' },
      { name: 'Analytics', route: '/analytics', iconName: 'activity', sequenceNo: 41, title: 'Analytics', permissionKey: 'analytics' },
      { name: 'Nav Tabs', route: '/nav-tabs', iconName: 'menu', sequenceNo: 42, title: 'Nav Tabs', permissionKey: 'navTab' },
    ]
  },
];

const getMenusForRole = (roleEnum: string) => {
  if (roleEnum === RoleEnum.SUPER_ADMIN) {
    return defaultMenus;
  }
  if (roleEnum === RoleEnum.ADMIN) {
    return defaultMenus.filter(m => ['dashboard', 'users', 'settings', 'employee-mgmt'].includes(m.permissionKey));
  }
  if (roleEnum === RoleEnum.MANAGER) {
    return defaultMenus.filter(m => ['dashboard', 'users', 'employee-mgmt'].includes(m.permissionKey));
  }
  if (roleEnum === RoleEnum.USER) {
    return defaultMenus.filter(m => ['dashboard', 'users', 'settings'].includes(m.permissionKey));
  }
  return [];
};

export const seedMenus = async () => {
  try {
    // Clear existing menus to remove any old role-linked data
    await Menu.deleteMany({});

    for (const menu of defaultMenus) {
      await Menu.create({
        ...menu,
        active: true,
        created: new Date(),
        updated: new Date()
      });
    }
    logger.info('Menus seeded successfully');
  } catch (error) {
    logger.error('Error seeding menus:', error);
  }
};
