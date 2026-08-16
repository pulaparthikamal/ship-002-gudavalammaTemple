import { Request, Response } from 'express';
import { bookingService } from './booking.service';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';

const currentUserId = (req: Request): string => {
  const user = req.user as { _id?: string } | undefined;
  return String(user?._id);
};

export const bookingController = {
  async list(req: Request, res: Response) {
    const filter = (req.query.filter as 'all' | 'upcoming' | 'past') || 'all';
    const bookings = await bookingService.list(currentUserId(req), filter);
    return res.json({ bookings });
  },

  async listAll(req: Request, res: Response) {
    const query = await serviceUtil.generateListQuery(req, 'Bookings');
    delete (query.filter as any).active;
    delete (query.filter as any).isDeleted;
    bookingService.applyQueryFilters(query.filter, req.query);

    const bookings = await bookingService.listAll(query);
    query.pagination.totalCount = await bookingService.totalCount(query);

    req.entityType = 'bookings';
    (req as any).bookings = bookings;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async cancel(req: Request, res: Response) {
    const booking = await bookingService.cancel(req.params.id, currentUserId(req), req.locale || 'en');
    return res.json({ success: true, booking });
  },

  async receipt(req: Request, res: Response) {
    const receipt = await bookingService.getReceipt(req.params.id, currentUserId(req), req.locale || 'en');
    return res.json({ receipt });
  },

  async submitPaymentReference(req: Request, res: Response) {
    const booking = await bookingService.submitPaymentReference(
      req.params.refId,
      String(req.body.paymentReference || '').trim(),
      req.locale || 'en'
    );
    return res.json({ booking });
  },

  async markPaid(req: Request, res: Response) {
    const booking = await bookingService.markPaid(
      req.params.id,
      req.body.paymentReference ? String(req.body.paymentReference).trim() : undefined,
      req.locale || 'en'
    );
    return res.json({ booking });
  },
};
