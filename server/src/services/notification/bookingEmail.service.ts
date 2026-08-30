import { sendMail } from '../../utils/mail.util';
import { translationService } from '../translation/translation.service';
import { TempleProfile } from '../../modules/templeProfile/templeProfile.model';
import { logger } from '../../utils/logger.util';

export interface BookingConfirmationInput {
  contactEmail?: string;
  contactName: string;
  type: string;
  title: string;
  amount: number;
  date: Date;
  status: string;
  referenceId: string;
  locale: string;
}

const LABELS = {
  greeting: 'Hello',
  subject: 'Your booking confirmation',
  heading: 'Booking Confirmed',
  type: 'Type',
  date: 'Date',
  amount: 'Amount',
  status: 'Status',
  reference: 'Reference ID',
  thankYou: 'Thank you for connecting with us.',
};

/**
 * Sends a booking/order/donation confirmation email, translated to the
 * booker's preferred locale, using the temple's name from TempleProfile.
 * Fire-and-forget from the caller's perspective — never throws, so a mail
 * failure can never fail the booking itself.
 */
export const sendBookingConfirmationEmail = async (input: BookingConfirmationInput): Promise<void> => {
  if (!input.contactEmail) return;

  try {
    const profile = await TempleProfile.findOne();
    const templeName = profile?.templeName ?? 'The Temple';

    const t = async (text: string) => translationService.translateText(text, 'en', input.locale);

    const [greeting, heading, typeLabel, dateLabel, amountLabel, statusLabel, referenceLabel, thankYou, subject] =
      await Promise.all([
        t(LABELS.greeting),
        t(LABELS.heading),
        t(LABELS.type),
        t(LABELS.date),
        t(LABELS.amount),
        t(LABELS.status),
        t(LABELS.reference),
        t(LABELS.thankYou),
        t(LABELS.subject),
      ]);

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#7c1220;">${templeName}</h2>
        <h3>${heading}</h3>
        <p>${greeting} ${input.contactName},</p>
        <table style="width:100%; border-collapse: collapse;">
          <tr><td style="padding:4px 0; color:#555;">${typeLabel}</td><td>${input.title}</td></tr>
          <tr><td style="padding:4px 0; color:#555;">${dateLabel}</td><td>${new Date(input.date).toLocaleDateString()}</td></tr>
          <tr><td style="padding:4px 0; color:#555;">${amountLabel}</td><td>₹${input.amount}</td></tr>
          <tr><td style="padding:4px 0; color:#555;">${statusLabel}</td><td>${input.status}</td></tr>
          <tr><td style="padding:4px 0; color:#555;">${referenceLabel}</td><td>${input.referenceId}</td></tr>
        </table>
        <p>${thankYou}</p>
      </div>
    `;

    await sendMail({ to: input.contactEmail, subject: `${subject} — ${templeName}`, html });
  } catch (error) {
    logger.warn(`[bookingEmail] Failed to send confirmation to ${input.contactEmail}: ${(error as Error).message}`);
  }
};
