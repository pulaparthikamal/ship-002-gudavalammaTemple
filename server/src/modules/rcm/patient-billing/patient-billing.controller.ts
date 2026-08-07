import { Request, Response } from 'express';
import { patientBillingService } from './patient-billing.service';
import { PatientBilling } from './patient-billing.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { rejectAppendOnlyMutation } from '../shared/rcm-lifecycle-safety';

export const patientBillingController = {
  async create(req: Request, res: Response) {
    const item = await patientBillingService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patientBilling';
    req.patientBilling = item;
    await serviceUtil.addActivity(
      req,
      'Patient Billing',
      'Create',
      `Created patient billing: ${item.statementDate ?? item._id}`,
      'patientBillingCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'patient-billings');
    const query = await serviceUtil.generateListQuery(req, 'patientBilling');

    const items = await (PatientBilling as any).list(query);
    query.pagination.totalCount = await (PatientBilling as any).totalCount(query);

    req.entityType = 'patientBillings';
    req.patientBillings = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await patientBillingService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'patientBilling';
    req.patientBilling = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await PatientBilling.findById(req.params.id);
    const item = await patientBillingService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patientBilling';
    req.patientBilling = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Patient Billing',
      'patientBillingUpdate',
      'statementDate'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async createFromPaymentPosting(req: Request, res: Response) {
    const item = await patientBillingService.createFromPaymentPosting(
      req.params.paymentPostingId,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patientBilling';
    req.patientBilling = item;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async action(req: Request, res: Response) {
    const item = await patientBillingService.applyAction(
      req.params.id,
      req.params.action,
      req.body ?? {},
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patientBilling';
    req.patientBilling = item;
    await serviceUtil.addActivity(
      req,
      'Patient Billing',
      'WorkflowAction',
      `Applied ${req.params.action} to patient billing: ${item.statementNumber ?? item._id}`,
      'patientBillingUpdate'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await PatientBilling.findById(req.params.id);
    await patientBillingService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patientBilling';
    req.patientBilling = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Patient Billing',
        'Delete',
        `Deleted patient billing: ${itemToDelete.statementDate ?? itemToDelete._id}`,
        'patientBillingDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    rejectAppendOnlyMutation('Patient billing', 'bulk deleted');
    const { ids } = req.body;
    await serviceUtil.bulkDelete(PatientBilling, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Patient Billing',
      'BulkDelete',
      `Bulk deleted ${ids.length} patient billings`,
      'patientBillingDelete'
    );

    req.i18nKey = 'patientBilling.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    rejectAppendOnlyMutation('Patient billing', 'bulk updated');
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(PatientBilling, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Patient Billing',
      'BulkUpdate',
      `Bulk updated ${ids.length} patient billings`,
      'patientBillingUpdate'
    );

    req.i18nKey = 'patientBilling.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
