import { Request, Response } from 'express';
import { prasadamService } from './prasadam.service';
import { PrasadamItem } from './prasadam.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';
import { resolveBooker } from '../../utils/guestCheckout.util';

export const prasadamController = {
  async listItems(req: Request, res: Response) {
    const items = await prasadamService.listItems();
    req.entityType = 'prasadamItems';
    req.prasadamItems = items;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async createItem(req: Request, res: Response) {
    const item = await prasadamService.createItem(req.body);

    req.entityType = 'prasadamItem';
    req.prasadamItem = item;
    await serviceUtil.addActivity(req, 'PrasadamItem', 'Create', `Created prasadam item: ${item.name}`, 'prasadamItemCreate');

    return res.json(respUtil.createSuccessResponse(req));
  },

  async updateItem(req: Request, res: Response) {
    const oldItem = await PrasadamItem.findById(req.params.id);
    const item = await prasadamService.updateItem(req.params.id, req.body, req.locale || 'en');

    req.entityType = 'prasadamItem';
    req.prasadamItem = item;
    await serviceUtil.logUpdateActivity(req, oldItem, item, 'PrasadamItem', 'prasadamItemUpdate', 'name');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async deleteItem(req: Request, res: Response) {
    const itemToDelete = await PrasadamItem.findById(req.params.id);
    await prasadamService.deleteItem(req.params.id, req.locale || 'en');

    req.entityType = 'prasadamItem';
    req.prasadamItem = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(req, 'PrasadamItem', 'Delete', `Deleted prasadam item: ${itemToDelete.name}`, 'prasadamItemDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async createOrder(req: Request, res: Response) {
    const booker = resolveBooker(req, req.body, req.locale || 'en');
    const order = await prasadamService.createOrder(booker, req.body, req.locale || 'en');

    req.entityType = 'prasadamOrder';
    req.prasadamOrder = order;

    return res.json(respUtil.createSuccessResponse(req));
  },
};
