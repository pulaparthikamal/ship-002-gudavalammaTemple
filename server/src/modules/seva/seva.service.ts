import { SevaCatalog, SevaBooking, ISevaCatalog } from './seva.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { bookingService } from '../booking/booking.service';
import { registerBookingCancelHandler } from '../booking/booking.registry';
import { ResolvedBooker } from '../../utils/guestCheckout.util';
import { sendBookingConfirmationEmail } from '../../services/notification/bookingEmail.service';
import { sendBookingConfirmationWhatsApp } from '../../services/notification/whatsapp.service';

export const DEFAULT_SEVA_CATALOG: Array<Pick<ISevaCatalog, 'slug' | 'name' | 'category' | 'timing' | 'price'>> = [
  { slug: 'suprabhatam', name: 'Suprabhata Seva', category: 'pratyaksha', timing: '4:30 AM daily', price: 120 },
  { slug: 'archana', name: 'Archana', category: 'pratyaksha', timing: '7:00 – 10:00 AM daily', price: 50 },
  { slug: 'kalyanotsavam', name: 'Kalyanotsavam', category: 'pratyaksha', timing: '8:00 AM daily', price: 1000 },
  { slug: 'sahasranamam', name: 'Sahasranama Archana', category: 'paroksha', timing: '9:00 AM daily', price: 250 },
  { slug: 'abhishekam', name: 'Abhishekam (Paroksha)', category: 'paroksha', timing: '5:00 AM (Wed & Sat)', price: 500 },
  { slug: 'vastralankarana', name: 'Vastralankarana Seva', category: 'paroksha', timing: '6:00 AM (Sun)', price: 750 },
  { slug: 'nitya-deeparadhana', name: 'Nitya Deeparadhana Saswata Seva', category: 'saswata', timing: 'Daily, in perpetuity', price: 5000 },
  { slug: 'vardhanti', name: 'Vardhanti (Birthday) Saswata Seva', category: 'saswata', timing: 'Annually, on your birth star day', price: 10000 },
  { slug: 'kalyanotsava-saswata', name: 'Kalyanotsava Saswata Seva', category: 'saswata', timing: 'Annually, in perpetuity', price: 25000 },
];

export const seedSevaCatalog = async () => {
  for (const item of DEFAULT_SEVA_CATALOG) {
    await SevaCatalog.findOneAndUpdate(
      { slug: item.slug },
      { $set: { ...item, active: true }, $setOnInsert: { created: new Date() } },
      { upsert: true, new: true }
    );
  }
};

export const sevaService = {
  async listActive() {
    const count = await SevaCatalog.countDocuments();
    if (count === 0) {
      await seedSevaCatalog();
    }
    return SevaCatalog.find({ active: true }).sort({ category: 1, name: 1 });
  },

  async create(data: any) {
    return SevaCatalog.create({ ...data, active: true, created: new Date(), updated: new Date() });
  },

  async update(id: string, data: any, locale: string) {
    data.updated = new Date();
    const seva = await SevaCatalog.findOneAndUpdate({ _id: id }, data, { new: true });
    if (!seva) {
      throw new AppError(t('seva.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return seva;
  },

  async delete(id: string, locale: string) {
    const seva = await SevaCatalog.findOneAndUpdate({ _id: id }, { active: false, updated: new Date() }, { new: true });
    if (!seva) {
      throw new AppError(t('seva.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },

  async createBooking(booker: ResolvedBooker, data: { sevaId: string; date?: string }, locale: string) {
    const seva = await SevaCatalog.findOne({ _id: data.sevaId, active: true });
    if (!seva) {
      throw new AppError(t('seva.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const bookingDate = data.date ? new Date(data.date) : new Date();

    const sevaBooking = await SevaBooking.create({
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      preferredLocale: booker.preferredLocale,
      seva: seva._id,
      date: bookingDate,
      amount: seva.price,
      status: 'confirmed',
    });

    await bookingService.createLedgerEntry({
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      type: 'seva',
      refId: String(sevaBooking._id),
      refModel: 'SevaBooking',
      title: seva.name,
      amount: seva.price,
      date: bookingDate,
      status: 'confirmed',
      paymentStatus: 'pending',
    });

    sendBookingConfirmationEmail({
      contactEmail: booker.contactEmail,
      contactName: booker.contactName,
      type: 'seva',
      title: seva.name,
      amount: seva.price,
      date: bookingDate,
      status: 'confirmed',
      referenceId: String(sevaBooking._id),
      locale: booker.preferredLocale,
    }).catch(() => undefined);

    sendBookingConfirmationWhatsApp({
      contactPhone: booker.contactPhone,
      contactName: booker.contactName,
      type: 'seva',
      title: seva.name,
      amount: seva.price,
      date: bookingDate,
      status: 'confirmed',
      referenceId: String(sevaBooking._id),
    }).catch(() => undefined);

    return sevaBooking;
  },
};

registerBookingCancelHandler('seva', async (refId: string) => {
  await SevaBooking.findByIdAndUpdate(refId, { status: 'cancelled', updated: new Date() });
});
