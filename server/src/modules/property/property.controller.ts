import { Request, Response } from 'express';
import { propertyService } from './property.service';
import { Property } from './property.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

export const propertyController = {
  async create(req: Request, res: Response) {
    const property = await propertyService.create(req.body);

    req.entityType = 'property';
    req.property = property;
    await serviceUtil.addActivity(req, 'Property', 'Create', `Created property: ${property.name}`, 'propertyCreate');

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'property');
    const query = await serviceUtil.generateListQuery(req, 'property');

    const properties = await (Property as any).list(query);
    query.pagination.totalCount = await (Property as any).totalCount(query);

    req.entityType = 'properties';
    req.properties = properties;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const property = await propertyService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'property';
    req.property = property;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldProperty = await Property.findById(req.params.id);
    const property = await propertyService.update(req.params.id, req.body, req.locale || 'en');

    req.entityType = 'property';
    req.property = property;
    await serviceUtil.logUpdateActivity(req, oldProperty, property, 'Property', 'propertyUpdate', 'name');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const propertyToDelete = await Property.findById(req.params.id);
    await propertyService.delete(req.params.id, req.locale || 'en');

    req.entityType = 'property';
    req.property = { _id: req.params.id };

    if (propertyToDelete) {
      await serviceUtil.addActivity(req, 'Property', 'Delete', `Deleted property: ${propertyToDelete.name}`, 'propertyDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  /**
   * Bulk Operations
   */
  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Property, ids, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Property', 'BulkDelete', `Bulk deleted ${ids.length} properties`, 'propertyDelete');

    req.i18nKey = 'property.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Property, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Property', 'BulkUpdate', `Bulk updated ${ids.length} properties`, 'propertyUpdate');

    req.i18nKey = 'property.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
