import { User } from './user.model';
import { Role } from '../role/role.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { PaginationMeta } from '../../types/pagination.types';
import { RoleEnum } from '../../constants/roles.constants';

export const userService = {
  async create(data: any, locale: string, createdBy: string) {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new AppError(t('user.emailExists', {}, locale), HTTP_STATUS.CONFLICT);
    }

    let roleId = data.role;

    if (!roleId) {
      const defaultRole = await Role.findOne({ role: RoleEnum.USER });
      if (!defaultRole) {
        throw new AppError(t('role.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      }
      roleId = defaultRole._id;
    }

    // Model pre-save hook handles hashing
    const user = await User.create({
      ...data,
      role: roleId,
      active: true,
      createdBy,
      created: new Date(),
      updated: new Date(),
    });

    const userObj = user.toObject();
    delete (userObj as any).password;
    delete (userObj as any).salt;
    return userObj;
  },

  async list(query: any, skip: number, limit: number, sort: any, filter: any) {
    const data = await User.find(filter)
      .populate('role')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);
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
    const user = await User.findOne({ _id: id, isDeleted: false }).populate('role');
    if (!user) {
      throw new AppError(t('user.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return user;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    if (data.role) {
      const role = await Role.findById(data.role);
      if (!role) {
        throw new AppError(t('role.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      }
    }
    
    data.updated = new Date();

    const user = await User.findOne({ _id: id, isDeleted: false });

    if (!user) {
      throw new AppError(t('user.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    // Assign data to user document
    Object.assign(user, data);
    user.updatedBy = updatedBy;
    user.updated = new Date();

    await user.save();
    await user.populate('role');

    return user;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const user = await User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), active: false, updatedBy, updated: new Date() },
      { new: true }
    );

    if (!user) {
      throw new AppError(t('user.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },

  async updateOwnLocale(id: string, preferredLocale: 'en' | 'te' | 'hi', locale: string) {
    const user = await User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { preferredLocale, updated: new Date() },
      { new: true }
    );

    if (!user) {
      throw new AppError(t('user.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return user;
  },

  async updateOwnProfile(
    id: string,
    data: { firstName?: string; lastName?: string; email?: string; phone?: string },
    locale: string
  ) {
    if (data.email) {
      const existingUser = await User.findOne({ email: data.email, _id: { $ne: id } });
      if (existingUser) {
        throw new AppError(t('user.emailExists', {}, locale), HTTP_STATUS.CONFLICT);
      }
    }

    const user = await User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { ...data, updated: new Date() },
      { new: true }
    ).populate('role');

    if (!user) {
      throw new AppError(t('user.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return user;
  },

  async toggleStatus(id: string, active: boolean, locale: string, updatedBy: string) {
    const user = await User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { active, updatedBy, updated: new Date() },
      { new: true }
    );

    if (!user) {
      throw new AppError(t('user.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return user;
  },
};
