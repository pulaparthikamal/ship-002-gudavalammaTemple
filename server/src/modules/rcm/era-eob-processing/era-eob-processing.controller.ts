import { Request, Response } from 'express';
import { eraEobProcessingService } from './era-eob-processing.service';
import { EraEobProcessing } from './era-eob-processing.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

export const eraEobProcessingController = {
  async import835(req: Request, res: Response) {
    const result = await eraEobProcessingService.import835(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'eraEobProcessing';
    req.eraEobProcessing = result.eraEobProcessing;
    await serviceUtil.addActivity(
      req,
      'ERA / EOB Processing',
      'Import835',
      `Imported 835 ERA: ${result.eraEobProcessing.paymentTraceNumber ?? result.eraEobProcessing._id}`,
      'eraEobProcessingImport835'
    );

    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async create(req: Request, res: Response) {
    const item = await eraEobProcessingService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'eraEobProcessing';
    req.eraEobProcessing = item;
    await serviceUtil.addActivity(
      req,
      'ERA / EOB Processing',
      'Create',
      `Created era / eob processing: ${item.checkNumber ?? item._id}`,
      'eraEobProcessingCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'era-eob-processings');
    const query = await serviceUtil.generateListQuery(req, 'eraEobProcessing');

    const items = await (EraEobProcessing as any).list(query);
    query.pagination.totalCount = await (EraEobProcessing as any).totalCount(query);

    req.entityType = 'eraEobProcessings';
    req.eraEobProcessings = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await eraEobProcessingService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'eraEobProcessing';
    req.eraEobProcessing = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async lockAccounting(req: Request, res: Response) {
    const item = await eraEobProcessingService.lockAccounting(
      req.params.id,
      req.body?.reason,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'eraEobProcessing';
    req.eraEobProcessing = item;
    await serviceUtil.addActivity(
      req,
      'ERA / EOB Processing',
      'AccountingLock',
      `Locked ERA accounting batch: ${item.paymentTraceNumber ?? item._id}`,
      'eraEobProcessingAccountingLock'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async unlockAccounting(req: Request, res: Response) {
    const item = await eraEobProcessingService.unlockAccounting(
      req.params.id,
      req.body?.reason,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'eraEobProcessing';
    req.eraEobProcessing = item;
    await serviceUtil.addActivity(
      req,
      'ERA / EOB Processing',
      'AccountingUnlock',
      `Unlocked ERA accounting batch: ${item.paymentTraceNumber ?? item._id}`,
      'eraEobProcessingAccountingUnlock'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async replay(req: Request, res: Response) {
    const result = await eraEobProcessingService.replay(
      req.params.id,
      req.body?.reason,
      req.locale || 'en',
      (req as any).user._id,
    );

    req.entityType = 'eraEobProcessing';
    req.eraEobProcessing = result.originalEra;
    await serviceUtil.addActivity(
      req,
      'ERA / EOB Processing',
      'Replay',
      `Replayed ERA accounting batch: ${result.originalEra.paymentTraceNumber ?? result.originalEra._id}`,
      'eraEobProcessingReplay'
    );

    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async update(req: Request, res: Response) {
    const oldItem = await EraEobProcessing.findById(req.params.id);
    const item = await eraEobProcessingService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'eraEobProcessing';
    req.eraEobProcessing = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'ERA / EOB Processing',
      'eraEobProcessingUpdate',
      'checkNumber'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await EraEobProcessing.findById(req.params.id);
    await eraEobProcessingService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'eraEobProcessing';
    req.eraEobProcessing = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'ERA / EOB Processing',
        'Delete',
        `Deleted era / eob processing: ${itemToDelete.checkNumber ?? itemToDelete._id}`,
        'eraEobProcessingDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    throw new AppError('ERA records are append-only and cannot be bulk deleted.', HTTP_STATUS.BAD_REQUEST);
  },

  async bulkUpdate(req: Request, res: Response) {
    throw new AppError('ERA records are append-only and cannot be bulk updated.', HTTP_STATUS.BAD_REQUEST);
  },
};
