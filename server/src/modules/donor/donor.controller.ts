import { Request, Response } from 'express';
import { donorService } from './donor.service';
import { Donor } from './donor.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

export const donorController = {
  async create(req: Request, res: Response) {
    const donor = await donorService.create(req.body);

    req.entityType = 'donor';
    req.donor = donor;
    await serviceUtil.addActivity(req, 'Donor', 'Create', `Created donor: ${donor.name}`, 'donorCreate');

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'donor');
    const query = await serviceUtil.generateListQuery(req, 'donor');

    const donors = await (Donor as any).list(query);
    query.pagination.totalCount = await (Donor as any).totalCount(query);

    req.entityType = 'donors';
    req.donors = donors;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const donor = await donorService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'donor';
    req.donor = donor;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldDonor = await Donor.findById(req.params.id);
    const donor = await donorService.update(req.params.id, req.body, req.locale || 'en');

    req.entityType = 'donor';
    req.donor = donor;
    await serviceUtil.logUpdateActivity(req, oldDonor, donor, 'Donor', 'donorUpdate', 'name');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const donorToDelete = await Donor.findById(req.params.id);
    await donorService.delete(req.params.id, req.locale || 'en');

    req.entityType = 'donor';
    req.donor = { _id: req.params.id };

    if (donorToDelete) {
      await serviceUtil.addActivity(req, 'Donor', 'Delete', `Deleted donor: ${donorToDelete.name}`, 'donorDelete');
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  /**
   * Donation history for a donor (walk-in / counter donations linked via Donation.donorId).
   */
  async getDonations(req: Request, res: Response) {
    const result = await donorService.getDonations(req.params.id, req.locale || 'en');
    req.entityType = 'donor';
    req.donor = result;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  /**
   * Bulk Operations
   */
  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Donor, ids, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Donor', 'BulkDelete', `Bulk deleted ${ids.length} donors`, 'donorDelete');

    req.i18nKey = 'donor.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Donor, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(req, 'Donor', 'BulkUpdate', `Bulk updated ${ids.length} donors`, 'donorUpdate');

    req.i18nKey = 'donor.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
