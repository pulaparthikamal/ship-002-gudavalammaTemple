import { Request, Response } from 'express';
import { patientService } from './patient.service';
import { Patient } from './patient.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const patientController = {
  async create(req: Request, res: Response) {
    const patient = await patientService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patient';
    req.patient = patient;
    await serviceUtil.addActivity(
      req,
      'Patient',
      'Create',
      `Created patient: ${patient.firstName} ${patient.lastName} (${patient.medicalRecordNumber})`,
      'patientCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'patients');
    const query = await serviceUtil.generateListQuery(req, 'patient');

    const patients = await (Patient as any).list(query);
    query.pagination.totalCount = await (Patient as any).totalCount(query);

    req.entityType = 'patients';
    req.patients = patients;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const patient = await patientService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'patient';
    req.patient = patient;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldPatient = await Patient.findById(req.params.id);
    const patient = await patientService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patient';
    req.patient = patient;
    await serviceUtil.logUpdateActivity(
      req,
      oldPatient,
      patient,
      'Patient',
      'patientUpdate',
      'medicalRecordNumber'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async duplicateCandidates(req: Request, res: Response) {
    const candidates = await patientService.getDuplicateCandidates(req.params.id, req.locale || 'en');
    req.entityType = 'patientDuplicateCandidates';
    (req as any).patientDuplicateCandidates = candidates;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async markNotDuplicate(req: Request, res: Response) {
    const patient = await patientService.markNotDuplicate(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );
    req.entityType = 'patient';
    req.patient = patient;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async mergeDuplicate(req: Request, res: Response) {
    const result = await patientService.mergeDuplicate(
      req.body.primaryPatientId,
      req.body.duplicatePatientId,
      req.locale || 'en',
      (req as any).user._id,
      req.body.notes
    );
    req.entityType = 'patientMerge';
    (req as any).patientMerge = result;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const patientToDelete = await Patient.findById(req.params.id);
    await patientService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'patient';
    req.patient = { _id: req.params.id };

    if (patientToDelete) {
      await serviceUtil.addActivity(
        req,
        'Patient',
        'Delete',
        `Deleted patient: ${patientToDelete.firstName} ${patientToDelete.lastName} (${patientToDelete.medicalRecordNumber})`,
        'patientDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Patient, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Patient',
      'BulkDelete',
      `Bulk deleted ${ids.length} patients`,
      'patientDelete'
    );

    req.i18nKey = 'patient.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Patient, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Patient',
      'BulkUpdate',
      `Bulk updated ${ids.length} patients`,
      'patientUpdate'
    );

    req.i18nKey = 'patient.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
