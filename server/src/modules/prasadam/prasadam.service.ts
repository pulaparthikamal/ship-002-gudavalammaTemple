import { PrasadamItem, PrasadamOrder } from './prasadam.model';
import { bookingService } from '../booking/booking.service';
import { registerBookingCancelHandler } from '../booking/booking.registry';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { ResolvedBooker } from '../../utils/guestCheckout.util';
import { sendBookingConfirmationEmail } from '../../services/notification/bookingEmail.service';
import { sendBookingConfirmationWhatsApp } from '../../services/notification/whatsapp.service';

const DEFAULT_ITEMS = [
  { slug: 'laddu-2', name: 'Laddu (Box of 2)', price: 50 },
  { slug: 'laddu-5', name: 'Laddu (Box of 5)', price: 120 },
  { slug: 'pulihora', name: 'Pulihora Packet', price: 40 },
  { slug: 'payasam', name: 'Payasam Cup', price: 60 },
];

export const prasadamService = {
  async listItems() {
    const count = await PrasadamItem.countDocuments({});
    if (count === 0) {
      await PrasadamItem.insertMany(DEFAULT_ITEMS.map((item) => ({ ...item, active: true })));
    }
    return PrasadamItem.find({ active: true }).sort({ price: 1 });
  },

  async createItem(data: any) {
    return PrasadamItem.create({ ...data, active: true, created: new Date(), updated: new Date() });
  },

  async updateItem(id: string, data: any, locale: string) {
    data.updated = new Date();
    const item = await PrasadamItem.findOneAndUpdate({ _id: id, active: true }, data, { new: true });
    if (!item) {
      throw new AppError(t('prasadamItem.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return item;
  },

  async deleteItem(id: string, locale: string) {
    const item = await PrasadamItem.findOneAndUpdate(
      { _id: id, active: true },
      { active: false, updated: new Date() },
      { new: true }
    );
    if (!item) {
      throw new AppError(t('prasadamItem.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },

  async createOrder(booker: ResolvedBooker, data: { items: Array<{ itemId: string; qty: number }> }, locale: string) {
    const itemIds = data.items.map((entry) => entry.itemId);
    const catalogItems = await PrasadamItem.find({ _id: { $in: itemIds }, active: true });

    if (catalogItems.length !== itemIds.length) {
      throw new AppError(t('prasadamOrder.invalidItem', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }

    const catalogById = new Map(catalogItems.map((item) => [String(item._id), item]));

    let amount = 0;
    let totalQty = 0;
    const orderItems = data.items.map((entry) => {
      const catalogItem = catalogById.get(entry.itemId)!;
      amount += catalogItem.price * entry.qty;
      totalQty += entry.qty;
      return {
        itemId: catalogItem._id,
        name: catalogItem.name,
        price: catalogItem.price,
        qty: entry.qty,
      };
    });

    const order = await PrasadamOrder.create({
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      preferredLocale: booker.preferredLocale,
      items: orderItems,
      amount,
      status: 'confirmed',
      paymentStatus: 'pending',
      created: new Date(),
      updated: new Date(),
    });

    const title = `Prasadam order (${totalQty} item${totalQty > 1 ? 's' : ''})`;

    await bookingService.createLedgerEntry({
      devotee: booker.devoteeId,
      guestName: booker.guestName,
      guestEmail: booker.guestEmail,
      guestPhone: booker.guestPhone,
      type: 'prasadam',
      refId: String(order._id),
      refModel: 'PrasadamOrder',
      title,
      amount,
      date: new Date(),
      status: 'confirmed',
      paymentStatus: 'pending',
    });

    sendBookingConfirmationEmail({
      contactEmail: booker.contactEmail,
      contactName: booker.contactName,
      type: 'prasadam',
      title,
      amount,
      date: new Date(),
      status: 'confirmed',
      referenceId: String(order._id),
      locale: booker.preferredLocale,
    }).catch(() => undefined);

    sendBookingConfirmationWhatsApp({
      contactPhone: booker.contactPhone,
      contactName: booker.contactName,
      type: 'prasadam',
      title,
      amount,
      date: new Date(),
      status: 'confirmed',
      referenceId: String(order._id),
    }).catch(() => undefined);

    return order;
  },

  async cancelOrder(refId: string, devoteeId: string) {
    await PrasadamOrder.findOneAndUpdate(
      { _id: refId, devotee: devoteeId },
      { status: 'cancelled', updated: new Date() }
    );
  },
};

registerBookingCancelHandler('prasadam', async (refId, devoteeId) => {
  await prasadamService.cancelOrder(refId, devoteeId);
});
