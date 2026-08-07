import { Role } from './role.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { getGlobalSearchQuery } from '../../utils/globalSearch.util';
import { PaginationQuery, PaginationMeta } from '../../types/pagination.types';

export const roleService = {
  async create(data: any, locale: string) {
    const existingRole = await Role.findOne({ role: data.role });
    if (existingRole) {
      throw new AppError(t('role.nameExists', {}, locale), HTTP_STATUS.CONFLICT);
    }

    const role = await Role.create({
      ...data,
      active: true,
      created: new Date(),
      updated: new Date(),
    });
    return role;
  },

  async list(query: PaginationQuery, skip: number, limit: number, sort: any) {
    const globalSearchFields = ['role', 'roleType', 'status'];
    const searchFilter = getGlobalSearchQuery(query.search || '', globalSearchFields);
    const filter = { ...searchFilter, active: true };

    const data = await Role.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Role.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const meta: PaginationMeta = {
      page: Number(query.page) || 1,
      limit,
      total,
      totalPages,
    };

    return { data, meta };
  },

  async getById(id: string, locale: string) {
    const role = await Role.findOne({ _id: id, active: true });
    if (!role) {
      throw new AppError(t('role.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return role;
  },

  async update(id: string, data: any, locale: string) {
    data.updated = new Date();
    const role = await Role.findOneAndUpdate({ _id: id, active: true }, data, { new: true });
    if (!role) {
      throw new AppError(t('role.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return role;
  },

  async delete(id: string, locale: string) {
    const role = await Role.findOneAndUpdate(
      { _id: id, active: true },
      { active: false, updated: new Date() },
      { new: true }
    );
    
    if (!role) {
      throw new AppError(t('role.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
