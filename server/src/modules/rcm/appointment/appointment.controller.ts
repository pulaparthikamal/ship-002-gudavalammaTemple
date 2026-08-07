import { Request, Response } from 'express';
import { appointmentService } from './appointment.service';
import { Appointment } from './appointment.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

function getAppointmentActivityLabel(item: { appointmentDate?: Date | string; appointmentTime?: string; _id?: unknown }) {
  return [item.appointmentDate, item.appointmentTime].filter(Boolean).join(' ') || String(item._id ?? '');
}

export const appointmentController = {
  async create(req: Request, res: Response) {
    const item = await appointmentService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'appointment';
    req.appointment = item;
    await serviceUtil.addActivity(
      req,
      'Appointment',
      'Create',
      `Created appointment: ${getAppointmentActivityLabel(item)}`,
      'appointmentCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'appointments');
    await appointmentService.reconcileCompletedAppointmentStatuses(
      (req as any).user?._id ? String((req as any).user._id) : undefined
    );
    const query = await serviceUtil.generateListQuery(req, 'appointment');

    const items = await (Appointment as any).list(query);
    query.pagination.totalCount = await (Appointment as any).totalCount(query);

    req.entityType = 'appointments';
    req.appointments = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async summary(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'appointments');
    await appointmentService.reconcileCompletedAppointmentStatuses(
      (req as any).user?._id ? String((req as any).user._id) : undefined
    );
    const query = await serviceUtil.generateListQuery(req, 'appointment');
    const summary = await appointmentService.getSummary(query.filter);

    return res.json(respUtil.dataSuccessResponse(req, summary, 'Appointment summary fetched successfully.'));
  },

  async getById(req: Request, res: Response) {
    const item = await appointmentService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'appointment';
    req.appointment = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Appointment.findById(req.params.id);
    const item = await appointmentService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'appointment';
    req.appointment = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Appointment',
      'appointmentUpdate',
      'appointmentTime'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async checkIn(req: Request, res: Response) {
    const result = await appointmentService.checkIn(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'appointment';
    req.appointment = result.appointment;
    await serviceUtil.addActivity(
      req,
      'Appointment',
      'Update',
      `Checked in appointment: ${getAppointmentActivityLabel(result.appointment)}`,
      'appointmentUpdate'
    );

    return res.json(respUtil.dataSuccessResponse(req, result, 'Appointment checked in successfully.'));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Appointment.findById(req.params.id);
    await appointmentService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'appointment';
    req.appointment = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Appointment',
        'Delete',
        `Deleted appointment: ${getAppointmentActivityLabel(itemToDelete)}`,
        'appointmentDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Appointment, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Appointment',
      'BulkDelete',
      `Bulk deleted ${ids.length} appointments`,
      'appointmentDelete'
    );

    req.i18nKey = 'appointment.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await appointmentService.bulkUpdate(ids, data, req.locale || 'en', (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Appointment',
      'BulkUpdate',
      `Bulk updated ${ids.length} appointments`,
      'appointmentUpdate'
    );

    req.i18nKey = 'appointment.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
