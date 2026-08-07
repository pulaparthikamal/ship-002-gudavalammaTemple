import { Request, Response } from 'express';
import { patientPaymentService } from './patient-payment.service';
import { PatientPayment } from './patient-payment.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { rejectAppendOnlyMutation } from '../shared/rcm-lifecycle-safety';

export const patientPaymentController = {
  async create(req: Request, res: Response) {
    const item = await patientPaymentService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patientPayment';
    req.patientPayment = item;
    await serviceUtil.addActivity(
      req,
      'Patient Payment',
      'Create',
      `Created patient payment: ${item.paymentDate ?? item._id}`,
      'patientPaymentCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'patient-payments');
    const query = await serviceUtil.generateListQuery(req, 'patientPayment');

    const items = await (PatientPayment as any).list(query);
    query.pagination.totalCount = await (PatientPayment as any).totalCount(query);

    req.entityType = 'patientPayments';
    req.patientPayments = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await patientPaymentService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'patientPayment';
    req.patientPayment = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await PatientPayment.findById(req.params.id);
    const item = await patientPaymentService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patientPayment';
    req.patientPayment = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Patient Payment',
      'patientPaymentUpdate',
      'paymentDate'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await PatientPayment.findById(req.params.id);
    await patientPaymentService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patientPayment';
    req.patientPayment = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Patient Payment',
        'Delete',
        `Deleted patient payment: ${itemToDelete.paymentDate ?? itemToDelete._id}`,
        'patientPaymentDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    rejectAppendOnlyMutation('Patient payment', 'bulk deleted');
    const { ids } = req.body;
    await serviceUtil.bulkDelete(PatientPayment, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Patient Payment',
      'BulkDelete',
      `Bulk deleted ${ids.length} patient payments`,
      'patientPaymentDelete'
    );

    req.i18nKey = 'patientPayment.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    rejectAppendOnlyMutation('Patient payment', 'bulk updated');
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(PatientPayment, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Patient Payment',
      'BulkUpdate',
      `Bulk updated ${ids.length} patient payments`,
      'patientPaymentUpdate'
    );

    req.i18nKey = 'patientPayment.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
