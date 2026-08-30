import { DarshanQuota, DarshanBooking, IDarshanQuota } from './darshan.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { bookingService } from '../booking/booking.service';
import { registerBookingCancelHandler } from '../booking/booking.registry';
import { ResolvedBooker } from '../../utils/guestCheckout.util';
import { sendBookingConfirmationEmail } from '../../services/notification/bookingEmail.service';
import { sendBookingConfirmationWhatsApp } from '../../services/notification/whatsapp.service';

export const DEFAULT_DARSHAN_QUOTAS: Array<Pick<IDarshanQuota, 'slug' | 'name' | 'price' | 'dailyCapacity'>> = [
  { slug: 'sarva', name: 'Sarva Darshan', price: 0, dailyCapacity: 500 },
  { slug: 'special', name: 'Special Entry Darshan', price: 300, dailyCapacity: 500 },
  { slug: 'senior', name: 'Senior Citizen / Divyang Darshan', price: 0, dailyCapacity: 500 },
];

export const seedDarshanQuotas = async () => {
  for (const item of DEFAULT_DARSHAN_QUOTAS) {
    await DarshanQuota.findOneAndUpdate(
      { slug: item.slug },
      { $set: { ...item, active: true }, $setOnInsert: { created: new Date() } },
      { upsert: true, new: true }
    );
  }
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const darshanService = {
  async listActive() {
    const count = await DarshanQuota.countDocuments();
    if (count === 0) {
      await seedDarshanQuotas();
    }
    return DarshanQuota.find({ active: true }).sort({ name: 1 });
  },

  async create(data: any) {
    return DarshanQuota.create({ ...data, active: true, created: new Date(), updated: new Date() });
  },

  async update(id: string, data: any, locale: string) {
    data.updated = new Date();
    const quota = await DarshanQuota.findOneAndUpdate({ _id: id }, data, { new: true });
    if (!quota) {
      throw new AppError(t('darshan.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return quota;
  },

  async delete(id: string, locale: string) {
    const quota = await DarshanQuota.findOneAndUpdate({ _id: id }, { active: false, updated: new Date() }, { new: true });
    if (!quota) {
      throw new AppError(t('darshan.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },

  async createBooking(
    booker: ResolvedBooker,
    data: { quotaId: string; date: string; devoteeCount: number },
    locale: string
  ) {
    const quota = await DarshanQuota.findOne({ _id: data.quotaId, active: true });
    if (!quota) {
      throw new AppError(t('darshan.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const bookingDate = new Date(data.date);

    const existing = await DarshanBooking.aggregate([
      {
        $match: {
          quota: quota._id,
          date: { $gte: startOfDay(bookingDate), $lte: endOfDay(bookingDate) },
          status: { $ne: 'cancelled' },
        },
      },
      { $group: { _id: null, total: { $sum: '$devoteeCount' } } },
    ]);

    const bookedCount = existing[0]?.total ?? 0;
    if (bookedCount + data.devoteeCount > quota.dailyCapacity) {
      throw new AppError(t('darshan.capacityExceeded', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }

    const amount = quota.price * data.devoteeCount;

    const darshanBooking = await DarshanBooking.create({
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      preferredLocale: booker.preferredLocale,
      quota: quota._id,
      date: bookingDate,
      devoteeCount: data.devoteeCount,
      amount,
      status: 'confirmed',
    });

    await bookingService.createLedgerEntry({
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      type: 'darshan',
      refId: String(darshanBooking._id),
      refModel: 'DarshanBooking',
      title: quota.name,
      amount,
      date: bookingDate,
      status: 'confirmed',
      paymentStatus: amount > 0 ? 'pending' : 'waived',
    });

    sendBookingConfirmationEmail({
      contactEmail: booker.contactEmail,
      contactName: booker.contactName,
      type: 'darshan',
      title: quota.name,
      amount,
      date: bookingDate,
      status: 'confirmed',
      referenceId: String(darshanBooking._id),
      locale: booker.preferredLocale,
    }).catch(() => undefined);

    sendBookingConfirmationWhatsApp({
      contactPhone: booker.contactPhone,
      contactName: booker.contactName,
      type: 'darshan',
      title: quota.name,
      amount,
      date: bookingDate,
      status: 'confirmed',
      referenceId: String(darshanBooking._id),
    }).catch(() => undefined);

    return darshanBooking;
  },
};

registerBookingCancelHandler('darshan', async (refId: string) => {
  await DarshanBooking.findByIdAndUpdate(refId, { status: 'cancelled', updated: new Date() });
});
