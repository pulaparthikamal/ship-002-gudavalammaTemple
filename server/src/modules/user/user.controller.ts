import { Request, Response } from 'express';
import { userService } from './user.service';
import { User } from './user.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

export const userController = {
  async create(req: Request, res: Response) {
    const user = await userService.create(req.body, req.locale || 'en', (req as any).user._id);
    
    req.entityType = 'user';
    req.user = user;
    await serviceUtil.addActivity(req, 'User', 'Create', `Created user: ${user.firstName} ${user.lastName} (${user.email})`, 'userCreate');
    
    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, "View", "users");
    const query = await serviceUtil.generateListQuery(req, "employee");
    
    const users = await (User as any).list(query);
    query.pagination.totalCount = await (User as any).totalCount(query);
    
    req.entityType = 'users';
    req.users = users;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const user = await userService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'user';
    req.user = user;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldUser = await User.findById(req.params.id);
    const user = await userService.update(req.params.id, req.body, req.locale || 'en', (req as any).user._id);
    
    req.entityType = 'user';
    req.user = user;
    await serviceUtil.logUpdateActivity(req, oldUser, user, 'User', 'userUpdate');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const userToDelete = await User.findById(req.params.id);
    await userService.softDelete(req.params.id, req.locale || 'en', (req as any).user._id);
    
    req.entityType = 'user';
    req.user = { _id: req.params.id };

    if (userToDelete) {
      await serviceUtil.addActivity(req, 'User', 'Delete', `Soft deleted user: ${userToDelete.email}`, 'userDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async updateOwnLocale(req: Request, res: Response) {
    const currentUserId = (req as any).user._id;
    const user = await userService.updateOwnLocale(currentUserId, req.body.preferredLocale, req.locale || 'en');

    req.entityType = 'user';
    req.user = user;

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async updateOwnProfile(req: Request, res: Response) {
    const currentUserId = (req as any).user._id;
    const user = await userService.updateOwnProfile(currentUserId, req.body, req.locale || 'en');

    req.entityType = 'user';
    req.user = user;

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async toggleStatus(req: Request, res: Response) {
    const user = await userService.toggleStatus(req.params.id, req.body.active, req.locale || 'en', (req as any).user._id);
    
    req.entityType = 'user';
    req.user = user;
    await serviceUtil.addActivity(req, 'User', 'StatusUpdate', `User ${user.email} status changed to ${req.body.active ? 'Active' : 'Inactive'}`, 'userUpdate');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  /**
   * Bulk Operations
   */
  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(User, ids, (req as any).user._id);
    await serviceUtil.addActivity(req, 'User', 'BulkDelete', `Bulk deleted ${ids.length} users`, 'userDelete');
    
    req.i18nKey = 'user.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(User, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(req, 'User', 'BulkUpdate', `Bulk updated ${ids.length} users`, 'userUpdate');
    
    req.i18nKey = 'user.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  }
};
