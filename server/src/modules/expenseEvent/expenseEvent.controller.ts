import { Request, Response } from 'express';
import { expenseEventService } from './expenseEvent.service';
import { ExpenseEvent } from './expenseEvent.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

export const expenseEventController = {
  async create(req: Request, res: Response) {
    const expenseEvent = await expenseEventService.create(req.body);

    req.entityType = 'expenseEvent';
    req.expenseEvent = expenseEvent;
    await serviceUtil.addActivity(req, 'ExpenseEvent', 'Create', `Created expense event: ${expenseEvent.name}`, 'expenseEventCreate');

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    const query = await serviceUtil.generateListQuery(req, 'ExpenseEvents');

    const expenseEvents = await (ExpenseEvent as any).list(query);
    query.pagination.totalCount = await (ExpenseEvent as any).totalCount(query);

    req.entityType = 'expenseEvents';
    req.expenseEvents = expenseEvents;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const expenseEvent = await expenseEventService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'expenseEvent';
    req.expenseEvent = expenseEvent;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldExpenseEvent = await ExpenseEvent.findById(req.params.id);
    const expenseEvent = await expenseEventService.update(req.params.id, req.body, req.locale || 'en');

    req.entityType = 'expenseEvent';
    req.expenseEvent = expenseEvent;
    await serviceUtil.logUpdateActivity(req, oldExpenseEvent, expenseEvent, 'ExpenseEvent', 'expenseEventUpdate', 'name');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const expenseEventToDelete = await ExpenseEvent.findById(req.params.id);
    await expenseEventService.delete(req.params.id, req.locale || 'en');

    req.entityType = 'expenseEvent';
    req.expenseEvent = { _id: req.params.id };

    if (expenseEventToDelete) {
      await serviceUtil.addActivity(req, 'ExpenseEvent', 'Delete', `Deleted expense event: ${expenseEventToDelete.name}`, 'expenseEventDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },
};
