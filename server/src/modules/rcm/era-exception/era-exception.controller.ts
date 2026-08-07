import { Request, Response } from 'express';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { EraException } from './era-exception.model';
import { eraExceptionService } from './era-exception.service';

export const eraExceptionController = {
  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'era-exceptions');
    const query = await serviceUtil.generateListQuery(req, 'eraException');
    const items = await (EraException as any).list(query);
    query.pagination.totalCount = await (EraException as any).totalCount(query);
    req.entityType = 'eraExceptions';
    (req as any).eraExceptions = items;
    (req as any).pagination = query.pagination;
    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await eraExceptionService.getById(req.params.id);
    req.entityType = 'eraException';
    (req as any).eraException = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async create(req: Request, res: Response) {
    const item = await eraExceptionService.create(req.body, (req as any).user._id);
    req.entityType = 'eraException';
    (req as any).eraException = item;
    await serviceUtil.addActivity(req, 'ERA Exception', 'Create', `Created ERA exception: ${item.exceptionType}`, 'eraExceptionCreate');
    return res.json(respUtil.createSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await EraException.findById(req.params.id);
    const item = await eraExceptionService.update(req.params.id, req.body, (req as any).user._id);
    req.entityType = 'eraException';
    (req as any).eraException = item;
    await serviceUtil.logUpdateActivity(req, oldItem, item, 'ERA Exception', 'eraExceptionUpdate', 'exceptionType');
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async action(req: Request, res: Response) {
    const item = await eraExceptionService.action(req.params.id, req.params.action, req.body ?? {}, (req as any).user._id);
    req.entityType = 'eraException';
    (req as any).eraException = item;
    await serviceUtil.addActivity(req, 'ERA Exception', 'Action', `${req.params.action}: ${item.exceptionType}`, 'eraExceptionAction');
    return res.json(respUtil.dataSuccessResponse(req, item, 'ERA exception action completed.'));
  },

  async aiExplain(req: Request, res: Response) {
    const item = await eraExceptionService.explainWithAi(req.params.id, (req as any).user._id);
    req.entityType = 'eraException';
    (req as any).eraException = item;
    await serviceUtil.addActivity(req, 'ERA Exception', 'AIExplain', `AI explained ERA exception: ${item.exceptionType}`, 'eraExceptionAiExplain');
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    await eraExceptionService.softDelete(req.params.id, (req as any).user._id);
    req.entityType = 'eraException';
    (req as any).eraException = { _id: req.params.id };
    return res.json(respUtil.removeSuccessResponse(req));
  },
};
