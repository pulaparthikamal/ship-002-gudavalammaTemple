import { Request, Response } from 'express';
import { donationService } from './donation.service';
import { Donation } from './donation.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';
import { resolveBooker } from '../../utils/guestCheckout.util';

export const donationController = {
  async list(req: Request, res: Response) {
    const query = await serviceUtil.generateListQuery(req, 'Donations');
    delete (query.filter as any).active;
    delete (query.filter as any).isDeleted;
    donationService.applyQueryFilters(query.filter, req.query);

    const donations = await (Donation as any).list(query);
    query.pagination.totalCount = await (Donation as any).totalCount(query);

    req.entityType = 'donations';
    (req as any).donations = donations;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async listFunds(req: Request, res: Response) {
    const funds = await donationService.listFunds();
    return res.json({ funds });
  },

  async createFund(req: Request, res: Response) {
    const donationFund = await donationService.createFund(req.body);
    req.entityType = 'donationFund';
    req.donationFund = donationFund;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async updateFund(req: Request, res: Response) {
    const donationFund = await donationService.updateFund(req.params.id, req.body, req.locale || 'en');
    req.entityType = 'donationFund';
    req.donationFund = donationFund;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async deleteFund(req: Request, res: Response) {
    await donationService.deleteFund(req.params.id, req.locale || 'en');
    req.entityType = 'donationFund';
    req.donationFund = { _id: req.params.id };
    return res.json(respUtil.removeSuccessResponse(req));
  },

  async create(req: Request, res: Response) {
    const { fundId, amount } = req.body as { fundId: string; amount: number };
    const booker = resolveBooker(req, req.body, req.locale || 'en');
    const donation = await donationService.createDonation(booker, fundId, amount, req.locale || 'en');
    return res.json({ donation });
  },

  async markPaid(req: Request, res: Response) {
    const donation = await donationService.markPaid(
      req.params.id,
      req.body.paymentReference ? String(req.body.paymentReference).trim() : undefined,
      req.locale || 'en'
    );
    return res.json({ donation });
  },
};
