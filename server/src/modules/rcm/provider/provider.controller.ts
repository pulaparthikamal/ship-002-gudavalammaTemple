import { Request, Response } from 'express';
import { providerService } from './provider.service';
import { Provider } from './provider.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const providerController = {
  async create(req: Request, res: Response) {
    const item = await providerService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'provider';
    req.provider = item;
    await serviceUtil.addActivity(
      req,
      'Provider',
      'Create',
      `Created provider: ${item.firstName ?? item._id}`,
      'providerCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'providers');
    const query = await serviceUtil.generateListQuery(req, 'provider');

    const items = await (Provider as any).list(query);
    query.pagination.totalCount = await (Provider as any).totalCount(query);

    req.entityType = 'providers';
    req.providers = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await providerService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'provider';
    req.provider = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Provider.findById(req.params.id);
    const item = await providerService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'provider';
    req.provider = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Provider',
      'providerUpdate',
      'firstName'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Provider.findById(req.params.id);
    await providerService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'provider';
    req.provider = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Provider',
        'Delete',
        `Deleted provider: ${itemToDelete.firstName ?? itemToDelete._id}`,
        'providerDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Provider, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Provider',
      'BulkDelete',
      `Bulk deleted ${ids.length} providers`,
      'providerDelete'
    );

    req.i18nKey = 'provider.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Provider, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Provider',
      'BulkUpdate',
      `Bulk updated ${ids.length} providers`,
      'providerUpdate'
    );

    req.i18nKey = 'provider.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
