import { Booking, BookingPaymentStatus, BookingStatus, BookingType } from './booking.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { getBookingCancelHandler } from './booking.registry';

export interface CreateLedgerEntryInput {
  devotee?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  type: BookingType;
  refId: string;
  refModel: string;
  title: string;
  amount: number;
  date: Date;
  status?: BookingStatus;
  paymentStatus?: BookingPaymentStatus;
}

/**
 * Merge explicit type/status/paymentStatus/from/to query params into the mongo
 * filter produced by generateListQuery, for the staff bookings ledger list.
 */
const applyQueryFilters = (filter: Record<string, any>, query: any) => {
  const { type, status, paymentStatus, from, to } = query || {};

  if (type) filter.type = String(type);
  if (status) filter.status = String(status);
  if (paymentStatus) filter.paymentStatus = String(paymentStatus);

  if (from || to) {
    filter.date = filter.date || {};
    if (from) filter.date.$gte = new Date(String(from));
    if (to) filter.date.$lte = new Date(String(to));
  }

  return filter;
};

export const bookingService = {
  applyQueryFilters,

  async createLedgerEntry(input: CreateLedgerEntryInput) {
    return Booking.create({
      ...input,
      status: input.status ?? 'pending',
      paymentStatus: input.paymentStatus ?? 'pending',
    });
  },

  async list(devoteeId: string, filter: 'all' | 'upcoming' | 'past' = 'all') {
    const query: Record<string, unknown> = { devotee: devoteeId };
    const now = new Date();
    if (filter === 'upcoming') query.date = { $gte: now };
    if (filter === 'past') query.date = { $lt: now };
    return Booking.find(query).sort({ date: -1 });
  },

  async listAll(query: any) {
    return (Booking as any).list(query);
  },

  async totalCount(query: any) {
    return (Booking as any).totalCount(query);
  },

  async getOwnedById(bookingId: string, devoteeId: string, locale: string) {
    const booking = await Booking.findOne({ _id: bookingId, devotee: devoteeId });
    if (!booking) {
      throw new AppError(t('booking.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return booking;
  },

  async cancel(bookingId: string, devoteeId: string, locale: string) {
    const booking = await this.getOwnedById(bookingId, devoteeId, locale);
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      throw new AppError(t('booking.cancel.notAllowed', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }

    const handler = getBookingCancelHandler(booking.type);
    if (handler) {
      await handler(String(booking.refId), devoteeId);
    }

    booking.status = 'cancelled';
    booking.updated = new Date();
    await booking.save();
    return booking;
  },

  async getReceipt(bookingId: string, devoteeId: string, locale: string) {
    const booking = await this.getOwnedById(bookingId, devoteeId, locale);
    return {
      bookingId: booking._id,
      type: booking.type,
      title: booking.title,
      amount: booking.amount,
      date: booking.date,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      issuedAt: new Date(),
    };
  },

  /**
   * Devotee (including guests, who have no session at all) self-reports the
   * UPI reference (UTR) shown in their own UPI app after paying — looked up
   * by `refId` (the domain booking/order/donation's own id, already known to
   * the frontend right after creation) rather than the ledger row's own id,
   * so no separate "find my booking" lookup/auth is needed for guests.
   */
  async submitPaymentReference(refId: string, paymentReference: string, locale: string) {
    if (!paymentReference) {
      throw new AppError(t('booking.paymentReference.required', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }

    const booking = await Booking.findOneAndUpdate(
      { refId },
      { paymentReference, updated: new Date() },
      { new: true }
    );
    if (!booking) {
      throw new AppError(t('booking.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return booking;
  },

  /** Staff reconciliation action — no gateway webhook exists to do this automatically. */
  async markPaid(bookingId: string, paymentReference: string | undefined, locale: string) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new AppError(t('booking.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    booking.paymentStatus = 'paid';
    if (paymentReference) {
      booking.paymentReference = paymentReference;
    }
    booking.updated = new Date();
    await booking.save();
    return booking;
  },
};
