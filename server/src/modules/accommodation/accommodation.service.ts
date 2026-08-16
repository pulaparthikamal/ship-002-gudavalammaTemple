import { AccommodationRoomType, AccommodationBooking } from './accommodation.model';
import { bookingService } from '../booking/booking.service';
import { registerBookingCancelHandler } from '../booking/booking.registry';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { ResolvedBooker } from '../../utils/guestCheckout.util';
import { sendBookingConfirmationEmail } from '../../services/notification/bookingEmail.service';
import { sendBookingConfirmationWhatsApp } from '../../services/notification/whatsapp.service';

const DEFAULT_ROOM_TYPES = [
  { slug: 'choultry', name: 'Devotee Choultry', detail: 'Shared hall · Donation based', pricePerNight: 0, totalRooms: 40 },
  { slug: 'non-ac', name: 'Non-AC Room', detail: '2 beds · Attached bath', pricePerNight: 500, totalRooms: 20 },
  { slug: 'ac-cottage', name: 'AC Cottage', detail: '2 beds · Premium amenities', pricePerNight: 1800, totalRooms: 10 },
  { slug: 'dormitory', name: 'Dormitory Bed', detail: 'Single bed · Common facility', pricePerNight: 100, totalRooms: 30 },
];

const MS_PER_NIGHT = 24 * 60 * 60 * 1000;

export const accommodationService = {
  async listRoomTypes() {
    const count = await AccommodationRoomType.countDocuments({});
    if (count === 0) {
      await AccommodationRoomType.insertMany(DEFAULT_ROOM_TYPES.map((room) => ({ ...room, active: true })));
    }
    return AccommodationRoomType.find({ active: true }).sort({ pricePerNight: 1 });
  },

  async createRoomType(data: any) {
    return AccommodationRoomType.create({ ...data, active: true, created: new Date(), updated: new Date() });
  },

  async getRoomTypeById(id: string, locale: string) {
    const roomType = await AccommodationRoomType.findOne({ _id: id, active: true });
    if (!roomType) {
      throw new AppError(t('accommodationRoomType.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return roomType;
  },

  async updateRoomType(id: string, data: any, locale: string) {
    data.updated = new Date();
    const roomType = await AccommodationRoomType.findOneAndUpdate({ _id: id, active: true }, data, { new: true });
    if (!roomType) {
      throw new AppError(t('accommodationRoomType.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return roomType;
  },

  async deleteRoomType(id: string, locale: string) {
    const roomType = await AccommodationRoomType.findOneAndUpdate(
      { _id: id, active: true },
      { active: false, updated: new Date() },
      { new: true }
    );
    if (!roomType) {
      throw new AppError(t('accommodationRoomType.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },

  async createBooking(
    booker: ResolvedBooker,
    data: { roomTypeId: string; checkIn: Date; checkOut: Date; guests: number },
    locale: string
  ) {
    const roomType = await AccommodationRoomType.findOne({ _id: data.roomTypeId, active: true });
    if (!roomType) {
      throw new AppError(t('accommodationRoomType.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (data.checkOut.getTime() <= data.checkIn.getTime()) {
      throw new AppError(t('accommodationBooking.invalidDates', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }

    const nights = Math.max(1, Math.ceil((data.checkOut.getTime() - data.checkIn.getTime()) / MS_PER_NIGHT));
    const amount = roomType.pricePerNight * nights;

    const booking = await AccommodationBooking.create({
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      preferredLocale: booker.preferredLocale,
      roomTypeId: roomType._id,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      guests: data.guests,
      amount,
      status: 'confirmed',
      paymentStatus: 'pending',
      created: new Date(),
      updated: new Date(),
    });

    await bookingService.createLedgerEntry({
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      type: 'accommodation',
      refId: String(booking._id),
      refModel: 'AccommodationBooking',
      title: `${roomType.name} · ${nights} night${nights > 1 ? 's' : ''}`,
      amount,
      date: data.checkIn,
      status: 'confirmed',
      paymentStatus: 'pending',
    });

    sendBookingConfirmationEmail({
      contactEmail: booker.contactEmail,
      contactName: booker.contactName,
      type: 'accommodation',
      title: `${roomType.name} · ${nights} night${nights > 1 ? 's' : ''}`,
      amount,
      date: data.checkIn,
      status: 'confirmed',
      referenceId: String(booking._id),
      locale: booker.preferredLocale,
    }).catch(() => undefined);

    sendBookingConfirmationWhatsApp({
      contactPhone: booker.contactPhone,
      contactName: booker.contactName,
      type: 'accommodation',
      title: `${roomType.name} · ${nights} night${nights > 1 ? 's' : ''}`,
      amount,
      date: data.checkIn,
      status: 'confirmed',
      referenceId: String(booking._id),
    }).catch(() => undefined);

    return booking;
  },

  async cancelBooking(refId: string, devoteeId: string) {
    await AccommodationBooking.findOneAndUpdate(
      { _id: refId, devotee: devoteeId },
      { status: 'cancelled', updated: new Date() }
    );
  },
};

registerBookingCancelHandler('accommodation', async (refId, devoteeId) => {
  await accommodationService.cancelBooking(refId, devoteeId);
});
