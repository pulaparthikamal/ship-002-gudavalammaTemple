import { Request, Response } from 'express';
import { documentService } from './document.service';
import { Document } from './document.model';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const documentController = {
  async upload(req: Request, res: Response) {
    const uploadedFile = await documentService.uploadFile(req.body, req.locale || 'en');

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      respMessage: 'File uploaded successfully',
      data: uploadedFile,
      meta: null,
      errors: null,
    });
  },

  async create(req: Request, res: Response) {
    const item = await documentService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'document';
    req.document = item;
    await serviceUtil.addActivity(
      req,
      'Document',
      'Create',
      `Created document: ${item.fileName ?? item._id}`,
      'documentCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'documents');
    const query = await serviceUtil.generateListQuery(req, 'document');

    const items = await (Document as any).list(query);
    query.pagination.totalCount = await (Document as any).totalCount(query);

    req.entityType = 'documents';
    req.documents = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await documentService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'document';
    req.document = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Document.findById(req.params.id);
    const item = await documentService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'document';
    req.document = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Document',
      'documentUpdate',
      'fileName'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Document.findById(req.params.id);
    await documentService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'document';
    req.document = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Document',
        'Delete',
        `Deleted document: ${itemToDelete.fileName ?? itemToDelete._id}`,
        'documentDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Document, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Document',
      'BulkDelete',
      `Bulk deleted ${ids.length} documents`,
      'documentDelete'
    );

    req.i18nKey = 'document.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Document, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Document',
      'BulkUpdate',
      `Bulk updated ${ids.length} documents`,
      'documentUpdate'
    );

    req.i18nKey = 'document.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
