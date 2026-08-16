import { Request } from 'express';
import { AppError } from './error.util';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { t } from '../i18n';

export interface GuestContactInput {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  preferredLocale?: string;
}

export interface ResolvedBooker {
  devoteeId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  preferredLocale: string;
  contactEmail?: string;
  contactPhone?: string;
  contactName: string;
}

/**
 * Resolves who is making a booking: the authenticated user (if
 * optionalAuthMiddleware populated req.user), or a guest — in which case
 * `guestName` plus at least one of `guestEmail`/`guestPhone` is required.
 * Used by every booking-creation controller that supports guest checkout.
 */
export const resolveBooker = (req: Request, data: GuestContactInput, locale: string): ResolvedBooker => {
  const user = req.user as { _id?: string; email?: string; phone?: string; firstName?: string; lastName?: string; preferredLocale?: string } | undefined;

  if (user?._id) {
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || '';
    return {
      devoteeId: String(user._id),
      preferredLocale: data.preferredLocale || user.preferredLocale || locale,
      contactEmail: user.email,
      contactPhone: user.phone,
      contactName: name,
    };
  }

  if (!data.guestName || !(data.guestEmail || data.guestPhone)) {
    throw new AppError(t('booking.guestContactRequired', {}, locale), HTTP_STATUS.BAD_REQUEST);
  }

  return {
    guestName: data.guestName,
    guestEmail: data.guestEmail,
    guestPhone: data.guestPhone,
    preferredLocale: data.preferredLocale || locale,
    contactEmail: data.guestEmail,
    contactPhone: data.guestPhone,
    contactName: data.guestName,
  };
};
