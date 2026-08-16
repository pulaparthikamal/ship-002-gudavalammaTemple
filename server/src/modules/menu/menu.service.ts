import { Menu, IMenu } from './menu.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { PaginationQuery, PaginationMeta } from '../../types/pagination.types';
import { Role } from '../role/role.model';
import { translationService } from '../../services/translation/translation.service';

export const menuService = {
  async create(data: any, locale: string) {
    const menu = await Menu.create({
      ...data,
      active: true,
      created: new Date(),
      updated: new Date(),
    });
    return menu;
  },

  async getFlatList(query: PaginationQuery, skip: number, limit: number, sort: any) {
    const data = await Menu.find({ active: true })
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Menu.countDocuments({ active: true });
    const totalPages = Math.ceil(total / limit);

    const meta: PaginationMeta = {
      page: Number(query.page) || 1,
      limit,
      total,
      totalPages,
    };

    return { data, meta };
  },

  async getTree() {
    return Menu.find({ active: true }).sort({ sequenceNo: 1 }).lean();
  },

  async getMyMenu(role: any, locale: string = 'en') {
    const menus = await Menu.find({ active: true }).sort({ sequenceNo: 1 }).lean();

    // Filter menus based on permissions
    const filtered = menus.filter((menu: any) => {
      // Check main menu permission
      const hasViewPermission = this._checkPermission(role, menu.permissionKey);
      if (!hasViewPermission) return false;

      // Filter submenus if any
      if (menu.submenu && menu.submenu.length > 0) {
        menu.submenu = menu.submenu.filter((sub: any) =>
          this._checkPermission(role, sub.permissionKey)
        );
      }

      return true;
    });

    if (locale === 'en') return filtered;

    for (const menu of filtered as any[]) {
      menu.title = await translationService.translateText(menu.title, 'en', locale);
      for (const sub of menu.submenu ?? []) {
        sub.title = await translationService.translateText(sub.title, 'en', locale);
      }
    }

    return filtered;
  },

  _checkPermission(role: any, permissionKey: string): boolean {
    if (!permissionKey) return true; // Default to true if no permission key is set
    
    // SUPER_ADMIN has full access
    if (role.role === 'SUPER_ADMIN') return true;

    const permissions = role.permissions;
    if (!permissions) return false;

    // Try exact match first
    let modulePermissions = typeof permissions.get === 'function'
      ? permissions.get(permissionKey)
      : (permissions as any)[permissionKey];

    // If not found, try case-insensitive match
    if (!modulePermissions) {
      const keys = typeof permissions.keys === 'function' ? Array.from(permissions.keys()) : Object.keys(permissions);
      const matchedKey = keys.find(k => (k as string).toLowerCase() === permissionKey.toLowerCase());
      if (matchedKey) {
        modulePermissions = typeof permissions.get === 'function'
          ? permissions.get(matchedKey as string)
          : (permissions as any)[matchedKey as string];
      }
    }

    return !!(modulePermissions && modulePermissions.actions.includes('View'));
  },

  async getById(id: string, locale: string) {
    const menu = await Menu.findOne({ _id: id, active: true });
    if (!menu) {
      throw new AppError(t('menu.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return menu;
  },

  async update(id: string, data: any, locale: string) {
    data.updated = new Date();
    const menu = await Menu.findOneAndUpdate({ _id: id, active: true }, data, { new: true });
    if (!menu) {
      throw new AppError(t('menu.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return menu;
  },

  async delete(id: string, locale: string) {
    const menu = await Menu.findOneAndUpdate(
      { _id: id, active: true },
      { active: false, updated: new Date() },
      { new: true }
    );
    
    if (!menu) {
      throw new AppError(t('menu.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
