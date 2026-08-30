import axios from 'axios';
import { envConfig } from '../../config/env.config';
import { TempleProfile } from '../../modules/templeProfile/templeProfile.model';
import { logger } from '../../utils/logger.util';

export interface BookingConfirmationWhatsAppInput {
  contactPhone?: string;
  contactName: string;
  type: string;
  title: string;
  amount: number;
  date: Date;
  status: string;
  referenceId: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Plain REST call to Meta's WhatsApp Cloud API — no SDK needed, it's one
 * HTTP request. Direct (not via Twilio) specifically to avoid Twilio's
 * per-message markup on top of Meta's own conversation pricing, per the
 * user's "free integrations only" instruction.
 *
 * Meta requires an approved message *template* for any business-initiated
 * message (a booking confirmation isn't a reply within a 24h customer-service
 * window) — free-form text is not an option here. Until a real confirmation
 * template is created and approved in the temple's Meta Business account,
 * this can only send Meta's zero-parameter "hello_world" quickstart demo
 * template (see envConfig.whatsappTemplateName) — a real connectivity test,
 * not yet a real confirmation. Swap in the real template name/language once
 * approved and this starts sending genuine booking details automatically.
 */
/** Returns whether a real send was actually attempted (`false` means it was
 * skipped because WhatsApp isn't configured — not a delivery failure, but
 * not a delivery either, so callers that report delivery status shouldn't
 * count it as sent). */
async function sendTemplateMessage(
  to: string,
  bodyParams: string[],
  templateOverride?: { name: string; language: string }
): Promise<boolean> {
  const { whatsappPhoneNumberId, whatsappAccessToken, whatsappApiVersion, whatsappTemplateName, whatsappTemplateLanguage } =
    envConfig;

  if (!whatsappPhoneNumberId || !whatsappAccessToken) {
    logger.info('[whatsapp] WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN not configured — skipping send.');
    return false;
  }

  const templateName = templateOverride?.name ?? whatsappTemplateName;
  const templateLanguage = templateOverride?.language ?? whatsappTemplateLanguage;
  const usingDemoTemplate = templateName === 'hello_world';

  await axios.post(
    `https://graph.facebook.com/${whatsappApiVersion}/${whatsappPhoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: normalizePhone(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLanguage },
        // Meta's "hello_world" demo template takes no body parameters at
        // all — only pass them once a real template (with placeholders) is
        // configured, or Meta rejects the call with a parameter-count error.
        ...(usingDemoTemplate || bodyParams.length === 0
          ? {}
          : { components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }] }),
      },
    },
    {
      headers: { Authorization: `Bearer ${whatsappAccessToken}` },
      timeout: 10_000,
    }
  );

  return true;
}

/**
 * Sends a booking/order/donation confirmation over WhatsApp, alongside the
 * existing email confirmation — fire-and-forget from the caller's
 * perspective (never throws), same pattern as sendBookingConfirmationEmail.
 * Only attempted when a phone number is present, finally closing the
 * long-standing "phone-only guest gets no confirmation at all" gap.
 */
export const sendBookingConfirmationWhatsApp = async (input: BookingConfirmationWhatsAppInput): Promise<void> => {
  if (!input.contactPhone) return;

  try {
    const profile = await TempleProfile.findOne();
    const templeName = profile?.templeName ?? 'The Temple';

    const summary = [
      templeName,
      `${input.type}: ${input.title}`,
      `Date: ${new Date(input.date).toLocaleDateString()}`,
      `Amount: ₹${input.amount}`,
      `Status: ${input.status}`,
      `Reference: ${input.referenceId}`,
    ].join(' | ');

    await sendTemplateMessage(input.contactPhone, [input.contactName, summary]);
  } catch (error) {
    logger.warn(`[whatsapp] Failed to send confirmation to ${input.contactPhone}: ${(error as Error).message}`);
  }
};

/**
 * Sends a devotee mobile-number-login OTP over WhatsApp. Uses its own
 * template env vars (`WHATSAPP_OTP_TEMPLATE_NAME`/`_LANGUAGE`) since an OTP
 * message needs Meta's dedicated "Authentication" template category — a
 * separate approval track from a general confirmation template. Unlike the
 * booking-confirmation sender, this **does not swallow errors** — the caller
 * needs to know whether the send actually succeeded, since email is the only
 * other delivery channel and both may be unavailable. Returns `false` (not a
 * thrown error) when WhatsApp isn't configured at all — see sendTemplateMessage.
 */
export const sendOtpWhatsApp = async (phone: string, code: string): Promise<boolean> => {
  return sendTemplateMessage(phone, [code], {
    name: envConfig.whatsappOtpTemplateName,
    language: envConfig.whatsappOtpTemplateLanguage,
  });
};
