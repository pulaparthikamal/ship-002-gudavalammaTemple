import { Request, Response } from 'express';
import { roleService } from './role.service';
import { Role } from './role.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

export const roleController = {
  async create(req: Request, res: Response) {
    const role = await roleService.create(req.body, req.locale || 'en');
    
    req.entityType = 'role';
    req.role = role;
    await serviceUtil.addActivity(req, 'Role', 'Create', `Created role: ${role.role}`, 'roleCreate');
    
    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, "View", "roles");
    const query = await serviceUtil.generateListQuery(req, "Roles");
    
    const roles = await (Role as any).list(query);
    query.pagination.totalCount = await (Role as any).totalCount(query);
    
    req.entityType = 'roles';
    req.roles = roles;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const role = await roleService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'role';
    req.role = role;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldRole = await Role.findById(req.params.id);
    const role = await roleService.update(req.params.id, req.body, req.locale || 'en');
    
    req.entityType = 'role';
    req.role = role;
    await serviceUtil.logUpdateActivity(req, oldRole, role, 'Role', 'roleUpdate', 'role');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const roleToDelete = await Role.findById(req.params.id);
    await roleService.delete(req.params.id, req.locale || 'en');
    
    req.entityType = 'role';
    req.role = { _id: req.params.id };

    if (roleToDelete) {
      await serviceUtil.addActivity(req, 'Role', 'Delete', `Deleted role: ${roleToDelete.role}`, 'roleDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  /**
   * Bulk Operations
   */
  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Role, ids, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Role', 'BulkDelete', `Bulk deleted ${ids.length} roles`, 'roleDelete');
    
    req.i18nKey = 'role.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Role, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Role', 'BulkUpdate', `Bulk updated ${ids.length} roles`, 'roleUpdate');
    
    req.i18nKey = 'role.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  }
};
