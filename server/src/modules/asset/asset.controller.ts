import { Request, Response } from 'express';
import { assetService } from './asset.service';
import { Asset } from './asset.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

export const assetController = {
  async create(req: Request, res: Response) {
    const asset = await assetService.create(req.body);

    req.entityType = 'asset';
    req.asset = asset;
    await serviceUtil.addActivity(req, 'Asset', 'Create', `Created asset: ${asset.name}`, 'assetCreate');

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'asset');
    const query = await serviceUtil.generateListQuery(req, 'asset');

    const assets = await (Asset as any).list(query);
    query.pagination.totalCount = await (Asset as any).totalCount(query);

    req.entityType = 'assets';
    req.assets = assets;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const asset = await assetService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'asset';
    req.asset = asset;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldAsset = await Asset.findById(req.params.id);
    const asset = await assetService.update(req.params.id, req.body, req.locale || 'en');

    req.entityType = 'asset';
    req.asset = asset;
    await serviceUtil.logUpdateActivity(req, oldAsset, asset, 'Asset', 'assetUpdate', 'name');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const assetToDelete = await Asset.findById(req.params.id);
    await assetService.delete(req.params.id, req.locale || 'en');

    req.entityType = 'asset';
    req.asset = { _id: req.params.id };

    if (assetToDelete) {
      await serviceUtil.addActivity(req, 'Asset', 'Delete', `Deleted asset: ${assetToDelete.name}`, 'assetDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  /**
   * Bulk Operations
   */
  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Asset, ids, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Asset', 'BulkDelete', `Bulk deleted ${ids.length} assets`, 'assetDelete');

    req.i18nKey = 'asset.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Asset, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Asset', 'BulkUpdate', `Bulk updated ${ids.length} assets`, 'assetUpdate');

    req.i18nKey = 'asset.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
