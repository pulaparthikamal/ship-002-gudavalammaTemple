import { TempleEvent, EventRegistration } from './templeEvent.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { ResolvedBooker } from '../../utils/guestCheckout.util';
import { sendBookingConfirmationEmail } from '../../services/notification/bookingEmail.service';
import { sendBookingConfirmationWhatsApp } from '../../services/notification/whatsapp.service';

export const templeEventService = {
  async listUpcoming() {
    return TempleEvent.find({ active: true }).sort({ startDate: 1 });
  },

  async create(data: any) {
    return TempleEvent.create({ ...data, active: data.active ?? true, created: new Date(), updated: new Date() });
  },

  async update(id: string, data: any, locale: string) {
    data.updated = new Date();
    const event = await TempleEvent.findOneAndUpdate({ _id: id }, data, { new: true });
    if (!event) {
      throw new AppError(t('templeEvent.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return event;
  },

  async delete(id: string, locale: string) {
    const event = await TempleEvent.findOneAndUpdate({ _id: id }, { active: false, updated: new Date() }, { new: true });
    if (!event) {
      throw new AppError(t('templeEvent.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },

  async listRegistrations(eventId: string) {
    return EventRegistration.find({ event: eventId }).sort({ registeredAt: -1 });
  },

  async listMyRegistrations(devoteeId: string) {
    return EventRegistration.find({ devotee: devoteeId }).populate('event').sort({ registeredAt: -1 });
  },

  async register(booker: ResolvedBooker, eventId: string, locale: string) {
    const event = await TempleEvent.findOne({ _id: eventId, active: true });
    if (!event) {
      throw new AppError(t('templeEvent.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (event.registrationDeadline && event.registrationDeadline.getTime() < Date.now()) {
      throw new AppError(t('templeEvent.registrationClosed', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }

    if (event.capacity) {
      const registeredCount = await EventRegistration.countDocuments({ event: event._id, status: { $ne: 'cancelled' } });
      if (registeredCount >= event.capacity) {
        throw new AppError(t('templeEvent.capacityFull', {}, locale), HTTP_STATUS.BAD_REQUEST);
      }
    }

    const registration = await EventRegistration.create({
      event: event._id,
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      preferredLocale: booker.preferredLocale,
      status: 'confirmed',
    });

    sendBookingConfirmationEmail({
      contactEmail: booker.contactEmail,
      contactName: booker.contactName,
      type: 'event',
      title: event.name,
      amount: 0,
      date: event.startDate,
      status: 'confirmed',
      referenceId: String(registration._id),
      locale: booker.preferredLocale,
    }).catch(() => undefined);

    sendBookingConfirmationWhatsApp({
      contactPhone: booker.contactPhone,
      contactName: booker.contactName,
      type: 'event',
      title: event.name,
      amount: 0,
      date: event.startDate,
      status: 'confirmed',
      referenceId: String(registration._id),
    }).catch(() => undefined);

    return registration;
  },
};
