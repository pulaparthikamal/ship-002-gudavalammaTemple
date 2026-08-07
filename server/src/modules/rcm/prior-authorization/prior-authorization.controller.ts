import { Request, Response } from 'express';
import { priorAuthorizationService } from './prior-authorization.service';
import { PriorAuthorization } from './prior-authorization.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const priorAuthorizationController = {
  async create(req: Request, res: Response) {
    const item = await priorAuthorizationService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'priorAuthorization';
    req.priorAuthorization = item;
    await serviceUtil.addActivity(
      req,
      'Prior Authorization',
      'Create',
      `Created prior authorization: ${item.authNumber ?? item._id}`,
      'priorAuthorizationCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'prior-authorizations');
    const query = await serviceUtil.generateListQuery(req, 'priorAuthorization');

    const items = await (PriorAuthorization as any).list(query);
    query.pagination.totalCount = await (PriorAuthorization as any).totalCount(query);

    req.entityType = 'priorAuthorizations';
    req.priorAuthorizations = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await priorAuthorizationService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'priorAuthorization';
    req.priorAuthorization = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await PriorAuthorization.findById(req.params.id);
    const item = await priorAuthorizationService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'priorAuthorization';
    req.priorAuthorization = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Prior Authorization',
      'priorAuthorizationUpdate',
      'authNumber'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async generatePacket(req: Request, res: Response) {
    const item = await priorAuthorizationService.generateAuthPacket(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );
    req.entityType = 'priorAuthorization';
    req.priorAuthorization = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async submitPacket(req: Request, res: Response) {
    const item = await priorAuthorizationService.submitPacket(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );
    req.entityType = 'priorAuthorization';
    req.priorAuthorization = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async checkPayerStatus(req: Request, res: Response) {
    const item = await priorAuthorizationService.checkPayerStatus(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );
    req.entityType = 'priorAuthorization';
    req.priorAuthorization = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await PriorAuthorization.findById(req.params.id);
    await priorAuthorizationService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'priorAuthorization';
    req.priorAuthorization = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Prior Authorization',
        'Delete',
        `Deleted prior authorization: ${itemToDelete.authNumber ?? itemToDelete._id}`,
        'priorAuthorizationDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(PriorAuthorization, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Prior Authorization',
      'BulkDelete',
      `Bulk deleted ${ids.length} prior authorizations`,
      'priorAuthorizationDelete'
    );

    req.i18nKey = 'priorAuthorization.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(PriorAuthorization, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Prior Authorization',
      'BulkUpdate',
      `Bulk updated ${ids.length} prior authorizations`,
      'priorAuthorizationUpdate'
    );

    req.i18nKey = 'priorAuthorization.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
