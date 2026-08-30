import { BookingType } from './booking.model';

/**
 * Each domain module (seva, darshan, accommodation, prasadam, donation) registers a
 * cancel handler here so the generic Booking ledger can cancel the underlying
 * domain record without this module importing every domain module directly.
 */
export interface BookingCancelHandler {
  (refId: string, devoteeId: string): Promise<void>;
}

const cancelHandlers = new Map<BookingType, BookingCancelHandler>();

export const registerBookingCancelHandler = (type: BookingType, handler: BookingCancelHandler): void => {
  cancelHandlers.set(type, handler);
};

export const getBookingCancelHandler = (type: BookingType): BookingCancelHandler | undefined => {
  return cancelHandlers.get(type);
};
