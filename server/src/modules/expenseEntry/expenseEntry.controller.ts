import { Request, Response } from 'express';
import { expenseEntryService } from './expenseEntry.service';
import { ExpenseEntry } from './expenseEntry.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

const currentUserId = (req: Request): string => {
  const user = req.user as { _id?: string } | undefined;
  return String(user?._id);
};

export const expenseEntryController = {
  async create(req: Request, res: Response) {
    const expenseEntry = await expenseEntryService.create(req.body, currentUserId(req));

    req.entityType = 'expenseEntry';
    req.expenseEntry = expenseEntry;
    await serviceUtil.addActivity(req, 'ExpenseEntry', 'Create', `Created expense entry: ${expenseEntry.category} (${expenseEntry.amount})`, 'expenseEntryCreate');

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    const query = await serviceUtil.generateListQuery(req, 'ExpenseEntries');
    expenseEntryService.applyQueryFilters(query.filter, req.query);

    const expenseEntries = await (ExpenseEntry as any).list(query);
    query.pagination.totalCount = await (ExpenseEntry as any).totalCount(query);

    req.entityType = 'expenseEntries';
    req.expenseEntries = expenseEntries;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const expenseEntry = await expenseEntryService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'expenseEntry';
    req.expenseEntry = expenseEntry;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldExpenseEntry = await ExpenseEntry.findById(req.params.id);
    const expenseEntry = await expenseEntryService.update(req.params.id, req.body, req.locale || 'en');

    req.entityType = 'expenseEntry';
    req.expenseEntry = expenseEntry;
    await serviceUtil.logUpdateActivity(req, oldExpenseEntry, expenseEntry, 'ExpenseEntry', 'expenseEntryUpdate', 'category');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const expenseEntryToDelete = await ExpenseEntry.findById(req.params.id);
    await expenseEntryService.delete(req.params.id, req.locale || 'en');

    req.entityType = 'expenseEntry';
    req.expenseEntry = { _id: req.params.id };

    if (expenseEntryToDelete) {
      await serviceUtil.addActivity(req, 'ExpenseEntry', 'Delete', `Deleted expense entry: ${expenseEntryToDelete.category}`, 'expenseEntryDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async summary(req: Request, res: Response) {
    const data = await expenseEntryService.summary(req.query);
    req.entityType = 'expenseEntrySummary';
    req.expenseEntrySummary = data;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async bulkCreate(req: Request, res: Response) {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const { created, errors } = await expenseEntryService.bulkCreate(entries, currentUserId(req));

    if (created.length > 0) {
      await serviceUtil.addActivity(req, 'ExpenseEntry', 'BulkCreate', `Bulk created ${created.length} expense entries`, 'expenseEntryBulkCreate');
    }

    req.entityType = 'expenseEntryBulk';
    req.expenseEntryBulk = { created, errors };
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },
};
