import { Request, Response } from 'express';
import { insurancePolicyService } from './insurance-policy.service';
import { InsurancePolicy } from './insurance-policy.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const insurancePolicyController = {
  async create(req: Request, res: Response) {
    const item = await insurancePolicyService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'insurancePolicy';
    req.insurancePolicy = item;
    await serviceUtil.addActivity(
      req,
      'Insurance Policy',
      'Create',
      `Created insurance policy: ${item.planName ?? item._id}`,
      'insurancePolicyCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'insurance-policies');
    const query = await serviceUtil.generateListQuery(req, 'insurancePolicy');

    const items = await (InsurancePolicy as any).list(query);
    query.pagination.totalCount = await (InsurancePolicy as any).totalCount(query);

    req.entityType = 'insurancePolicies';
    req.insurancePolicies = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await insurancePolicyService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'insurancePolicy';
    req.insurancePolicy = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await InsurancePolicy.findById(req.params.id);
    const item = await insurancePolicyService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'insurancePolicy';
    req.insurancePolicy = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Insurance Policy',
      'insurancePolicyUpdate',
      'planName'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await InsurancePolicy.findById(req.params.id);
    await insurancePolicyService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'insurancePolicy';
    req.insurancePolicy = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Insurance Policy',
        'Delete',
        `Deleted insurance policy: ${itemToDelete.planName ?? itemToDelete._id}`,
        'insurancePolicyDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(InsurancePolicy, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Insurance Policy',
      'BulkDelete',
      `Bulk deleted ${ids.length} insurance policies`,
      'insurancePolicyDelete'
    );

    req.i18nKey = 'insurancePolicy.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(InsurancePolicy, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Insurance Policy',
      'BulkUpdate',
      `Bulk updated ${ids.length} insurance policies`,
      'insurancePolicyUpdate'
    );

    req.i18nKey = 'insurancePolicy.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
