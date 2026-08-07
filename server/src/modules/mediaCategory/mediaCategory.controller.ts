import { Request, Response } from 'express';
import { mediaCategoryService } from './mediaCategory.service';
import { MediaCategory } from './mediaCategory.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

export const mediaCategoryController = {
  async create(req: Request, res: Response) {
    const topic = await mediaCategoryService.create(req.body, req.locale || 'en', (req as any).user._id);
    
    req.entityType = 'mediaCategory';
    req.mediaCategory = topic;
    await serviceUtil.addActivity(req, 'MediaCategory', 'Create', `Created social media topic: ${topic.name}`, 'topicCreate');
    
    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, "View", "mediaCategorys");
    const query = await serviceUtil.generateListQuery(req, "employee");
    
    const topics = await (MediaCategory as any).list(query);
    query.pagination.totalCount = await (MediaCategory as any).totalCount(query);
    
    req.entityType = 'mediaCategorys';
    req.mediaCategorys = topics;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const topic = await mediaCategoryService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'mediaCategory';
    req.mediaCategory = topic;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldTopic = await MediaCategory.findById(req.params.id);
    const topic = await mediaCategoryService.update(req.params.id, req.body, req.locale || 'en', (req as any).user._id);
    
    req.entityType = 'mediaCategory';
    req.mediaCategory = topic;
    await serviceUtil.logUpdateActivity(req, oldTopic, topic, 'MediaCategory', 'topicUpdate');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const topicToDelete = await MediaCategory.findById(req.params.id);
    await mediaCategoryService.softDelete(req.params.id, req.locale || 'en', (req as any).user._id);
    
    req.entityType = 'mediaCategory';
    req.mediaCategory = { _id: req.params.id };

    if (topicToDelete) {
      await serviceUtil.addActivity(req, 'MediaCategory', 'Delete', `Soft deleted social media topic: ${topicToDelete.name}`, 'topicDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async toggleStatus(req: Request, res: Response) {
    const topic = await mediaCategoryService.toggleStatus(req.params.id, req.body.active, req.locale || 'en', (req as any).user._id);
    
    req.entityType = 'mediaCategory';
    req.mediaCategory = topic;
    await serviceUtil.addActivity(req, 'MediaCategory', 'StatusUpdate', `Social media topic ${topic.name} status changed to ${req.body.active ? 'Active' : 'Inactive'}`, 'topicUpdate');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(MediaCategory, ids, (req as any).user._id);
    await serviceUtil.addActivity(req, 'MediaCategory', 'BulkDelete', `Bulk deleted ${ids.length} social media topics`, 'topicDelete');
    
    req.i18nKey = 'mediaCategory.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(MediaCategory, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(req, 'MediaCategory', 'BulkUpdate', `Bulk updated ${ids.length} social media topics`, 'topicUpdate');
    
    req.i18nKey = 'mediaCategory.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async generateContent(req: Request, res: Response) {
    const topic = await mediaCategoryService.generateContent(req.params.id, req.locale || 'en', (req as any).user._id);
    
    req.entityType = 'mediaCategory';
    req.mediaCategory = topic;
    await serviceUtil.addActivity(req, 'MediaCategory', 'ContentGeneration', `Generated content for social media topic: ${topic.name}`, 'topicUpdate');
    
    return res.json(respUtil.updateSuccessResponse(req));
  }
};
