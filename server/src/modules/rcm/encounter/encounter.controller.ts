import { Request, Response } from 'express';
import { encounterService } from './encounter.service';
import { Encounter } from './encounter.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const encounterController = {
  async create(req: Request, res: Response) {
    const item = await encounterService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'encounter';
    req.encounter = item;
    await serviceUtil.addActivity(
      req,
      'Encounter',
      'Create',
      `Created encounter: ${item.encounterDate ?? item._id}`,
      'encounterCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'encounters');
    const query = await serviceUtil.generateListQuery(req, 'encounter');

    const items = await (Encounter as any).list(query);
    query.pagination.totalCount = await (Encounter as any).totalCount(query);

    req.entityType = 'encounters';
    req.encounters = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await encounterService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'encounter';
    req.encounter = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Encounter.findById(req.params.id);
    const item = await encounterService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'encounter';
    req.encounter = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Encounter',
      'encounterUpdate',
      'encounterDate'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async suggestAiCodes(req: Request, res: Response) {
    const result = await encounterService.suggestAiCodes(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id,
      req.body
    );

    req.entityType = 'encounter';
    req.encounter = result.encounter;
    await serviceUtil.addActivity(
      req,
      'Encounter',
      'Update',
      `${result.suggestions.applySuggestions ? 'Applied' : 'Generated'} AI coding suggestions for encounter: ${result.encounter.encounterDate ?? result.encounter._id}`,
      'encounterUpdate'
    );

    return res.json(respUtil.dataSuccessResponse(req, result, 'AI coding suggestions generated successfully.'));
  },

  async complete(req: Request, res: Response) {
    const result = await encounterService.complete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'encounter';
    req.encounter = result.encounter;
    await serviceUtil.addActivity(
      req,
      'Encounter',
      'Update',
      `Completed encounter: ${result.encounter.encounterDate ?? result.encounter._id}`,
      'encounterUpdate'
    );

    return res.json(respUtil.dataSuccessResponse(req, result, 'Encounter completed successfully.'));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Encounter.findById(req.params.id);
    await encounterService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'encounter';
    req.encounter = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Encounter',
        'Delete',
        `Deleted encounter: ${itemToDelete.encounterDate ?? itemToDelete._id}`,
        'encounterDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    for (const id of ids) {
      await encounterService.softDelete(
        id,
        req.locale || 'en',
        (req as any).user._id
      );
    }
    await serviceUtil.addActivity(
      req,
      'Encounter',
      'BulkDelete',
      `Bulk deleted ${ids.length} encounters`,
      'encounterDelete'
    );

    req.i18nKey = 'encounter.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    for (const id of ids) {
      await encounterService.update(id, data, req.locale || 'en', (req as any).user._id);
    }
    await serviceUtil.addActivity(
      req,
      'Encounter',
      'BulkUpdate',
      `Bulk updated ${ids.length} encounters`,
      'encounterUpdate'
    );

    req.i18nKey = 'encounter.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
