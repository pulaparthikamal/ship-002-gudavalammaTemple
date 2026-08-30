import { Types } from 'mongoose';
import { DonationFund, IDonationFund } from './donationFund.model';
import { Donation } from './donation.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { bookingService } from '../booking/booking.service';
import { registerBookingCancelHandler } from '../booking/booking.registry';
import { ResolvedBooker } from '../../utils/guestCheckout.util';
import { sendBookingConfirmationEmail } from '../../services/notification/bookingEmail.service';
import { sendBookingConfirmationWhatsApp } from '../../services/notification/whatsapp.service';

/**
 * Merge explicit fundId/status/paymentStatus/from/to query params into the mongo
 * filter produced by generateListQuery, for the staff donations ledger list.
 */
const applyQueryFilters = (filter: Record<string, any>, query: any) => {
  const { fundId, status, paymentStatus, from, to } = query || {};

  if (fundId && Types.ObjectId.isValid(String(fundId))) {
    filter.fundId = new Types.ObjectId(String(fundId));
  }
  if (status) filter.status = String(status);
  if (paymentStatus) filter.paymentStatus = String(paymentStatus);

  if (from || to) {
    filter.created = filter.created || {};
    if (from) filter.created.$gte = new Date(String(from));
    if (to) filter.created.$lte = new Date(String(to));
  }

  return filter;
};

const DEFAULT_FUNDS: Array<Pick<IDonationFund, 'slug' | 'name' | 'description'>> = [
  {
    slug: 'hundi',
    name: 'Hundi',
    description: 'Offer your donation into the temple Hundi for the general welfare of the temple.',
  },
  {
    slug: 'annadanam',
    name: 'Annadanam',
    description: 'Sponsor free meals served daily to devotees and pilgrims.',
  },
  {
    slug: 'goSamrakshana',
    name: 'Go Samrakshana',
    description: 'Support the care and protection of temple cows (Go Samrakshana).',
  },
];

const generateReceiptNo = (): string => {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DN-${Date.now()}-${random}`;
};

export const donationService = {
  applyQueryFilters,

  async listFunds() {
    const count = await DonationFund.countDocuments();
    if (count === 0) {
      await DonationFund.insertMany(
        DEFAULT_FUNDS.map((fund) => ({ ...fund, active: true, created: new Date(), updated: new Date() }))
      );
    }
    return DonationFund.find({ active: true }).sort({ created: 1 });
  },

  async createFund(data: any) {
    return DonationFund.create({ ...data, active: true, created: new Date(), updated: new Date() });
  },

  async updateFund(id: string, data: any, locale: string) {
    data.updated = new Date();
    const fund = await DonationFund.findOneAndUpdate({ _id: id }, data, { new: true });
    if (!fund) {
      throw new AppError(t('donation.fundNotFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return fund;
  },

  async deleteFund(id: string, locale: string) {
    const fund = await DonationFund.findOneAndUpdate({ _id: id }, { active: false, updated: new Date() }, { new: true });
    if (!fund) {
      throw new AppError(t('donation.fundNotFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },

  async createDonation(booker: ResolvedBooker, fundId: string, amount: number, locale: string) {
    const fund = await DonationFund.findOne({ _id: fundId, active: true });
    if (!fund) {
      throw new AppError(t('donation.fundNotFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const donation = await Donation.create({
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      preferredLocale: booker.preferredLocale,
      fundId: fund._id,
      amount,
      paymentStatus: 'pending',
      status: 'confirmed',
      receiptNo: generateReceiptNo(),
    });

    await bookingService.createLedgerEntry({
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      type: 'donation',
      refId: String(donation._id),
      refModel: 'Donation',
      title: fund.name,
      amount,
      date: new Date(),
      status: 'confirmed',
      paymentStatus: 'pending',
    });

    sendBookingConfirmationEmail({
      contactEmail: booker.contactEmail,
      contactName: booker.contactName,
      type: 'donation',
      title: fund.name,
      amount,
      date: new Date(),
      status: 'confirmed',
      referenceId: donation.receiptNo,
      locale: booker.preferredLocale,
    }).catch(() => undefined);

    sendBookingConfirmationWhatsApp({
      contactPhone: booker.contactPhone,
      contactName: booker.contactName,
      type: 'donation',
      title: fund.name,
      amount,
      date: new Date(),
      status: 'confirmed',
      referenceId: donation.receiptNo,
    }).catch(() => undefined);

    return donation;
  },

  /** Staff reconciliation action — no gateway webhook exists to do this automatically. */
  async markPaid(donationId: string, paymentReference: string | undefined, locale: string) {
    const donation = await Donation.findById(donationId);
    if (!donation) {
      throw new AppError(t('donation.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    donation.paymentStatus = 'paid';
    if (paymentReference) {
      donation.paymentReference = paymentReference;
    }
    donation.updated = new Date();
    await donation.save();
    return donation;
  },
};

registerBookingCancelHandler('donation', async (refId: string) => {
  await Donation.findByIdAndUpdate(refId, { status: 'cancelled', updated: new Date() });
});
