import { query, Request, Response } from 'express';
import { menuService } from './menu.service';
import { Menu } from './menu.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

export const menuController = {
  async create(req: Request, res: Response) {
    const menu = await menuService.create(req.body, req.locale || 'en');
    
    req.entityType = 'menu';
    req.menu = menu;
    await serviceUtil.addActivity(req, 'Menu', 'Create', `Created menu: ${menu.title}`, 'menuCreate');
    
    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, "View", "menus");
    const query = await serviceUtil.generateListQuery(req, "Menus");
    
    const menus = await (Menu as any).list(query);
    query.pagination.totalCount = await (Menu as any).totalCount(query);
    
    req.entityType = 'menus';
    req.menus = menus;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getTree(req: Request, res: Response) {
    const data = await menuService.getTree();
    req.entityType = 'menu';
    req.menu = data;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async getMyMenu(req: Request, res: Response) {
    const data = await menuService.getMyMenu((req as any).user.role, req.locale || 'en');
    req.entityType = 'menu';
    req.menu = data;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async getFlatList(req: Request, res: Response) {
    return menuController.list(req, res);
  },

  async getById(req: Request, res: Response) {
    const menu = await menuService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'menu';
    req.menu = menu;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldMenu = await Menu.findById(req.params.id);
    const menu = await menuService.update(req.params.id, req.body, req.locale || 'en');
    
    req.entityType = 'menu';
    req.menu = menu;
    await serviceUtil.logUpdateActivity(req, oldMenu, menu, 'Menu', 'menuUpdate', 'title');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const menuToDelete = await Menu.findById(req.params.id);
    await menuService.delete(req.params.id, req.locale || 'en');
    
    req.entityType = 'menu';
    req.menu = { _id: req.params.id };

    if (menuToDelete) {
      await serviceUtil.addActivity(req, 'Menu', 'Delete', `Deleted menu: ${menuToDelete.title}`, 'menuDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  /**
   * Bulk Operations
   */
  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Menu, ids, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Menu', 'BulkDelete', `Bulk deleted ${ids.length} menus`, 'menuDelete');
    
    req.i18nKey = 'menu.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Menu, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Menu', 'BulkUpdate', `Bulk updated ${ids.length} menus`, 'menuUpdate');
    
    req.i18nKey = 'menu.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  }
};
