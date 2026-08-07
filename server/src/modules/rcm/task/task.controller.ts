import { Request, Response } from 'express';
import { taskService } from './task.service';
import { Task } from './task.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const taskController = {
  async create(req: Request, res: Response) {
    const item = await taskService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'task';
    req.task = item;
    await serviceUtil.addActivity(
      req,
      'Task',
      'Create',
      `Created task: ${item.workflowStage ?? item._id}`,
      'taskCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'tasks');
    const query = await serviceUtil.generateListQuery(req, 'task');

    const items = await (Task as any).list(query);
    query.pagination.totalCount = await (Task as any).totalCount(query);

    req.entityType = 'tasks';
    req.tasks = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await taskService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'task';
    req.task = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Task.findById(req.params.id);
    const item = await taskService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'task';
    req.task = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Task',
      'taskUpdate',
      'workflowStage'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Task.findById(req.params.id);
    await taskService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'task';
    req.task = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Task',
        'Delete',
        `Deleted task: ${itemToDelete.workflowStage ?? itemToDelete._id}`,
        'taskDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Task, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Task',
      'BulkDelete',
      `Bulk deleted ${ids.length} tasks`,
      'taskDelete'
    );

    req.i18nKey = 'task.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Task, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Task',
      'BulkUpdate',
      `Bulk updated ${ids.length} tasks`,
      'taskUpdate'
    );

    req.i18nKey = 'task.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
