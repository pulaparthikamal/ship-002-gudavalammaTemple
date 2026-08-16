import { Request, Response } from 'express';
import { liabilityService } from './liability.service';
import { Liability } from './liability.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

export const liabilityController = {
  async create(req: Request, res: Response) {
    const liability = await liabilityService.create(req.body);

    req.entityType = 'liability';
    req.liability = liability;
    await serviceUtil.addActivity(req, 'Liability', 'Create', `Created liability: ${liability.name}`, 'liabilityCreate');

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'liability');
    const query = await serviceUtil.generateListQuery(req, 'liability');

    const liabilities = await (Liability as any).list(query);
    query.pagination.totalCount = await (Liability as any).totalCount(query);

    req.entityType = 'liabilities';
    req.liabilities = liabilities;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const liability = await liabilityService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'liability';
    req.liability = liability;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldLiability = await Liability.findById(req.params.id);
    const liability = await liabilityService.update(req.params.id, req.body, req.locale || 'en');

    req.entityType = 'liability';
    req.liability = liability;
    await serviceUtil.logUpdateActivity(req, oldLiability, liability, 'Liability', 'liabilityUpdate', 'name');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const liabilityToDelete = await Liability.findById(req.params.id);
    await liabilityService.delete(req.params.id, req.locale || 'en');

    req.entityType = 'liability';
    req.liability = { _id: req.params.id };

    if (liabilityToDelete) {
      await serviceUtil.addActivity(req, 'Liability', 'Delete', `Deleted liability: ${liabilityToDelete.name}`, 'liabilityDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  /**
   * Bulk Operations
   */
  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Liability, ids, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Liability', 'BulkDelete', `Bulk deleted ${ids.length} liabilities`, 'liabilityDelete');

    req.i18nKey = 'liability.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Liability, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Liability', 'BulkUpdate', `Bulk updated ${ids.length} liabilities`, 'liabilityUpdate');

    req.i18nKey = 'liability.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
