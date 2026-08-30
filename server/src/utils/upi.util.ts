/**
 * Builds a standard UPI deep link (`upi://pay?...`), per the publicly
 * documented NPCI UPI linking spec. Opens the payer's own UPI app (GPay/
 * PhonePe/Paytm/BHIM/etc.) for a direct bank-to-bank transfer straight to the
 * temple's own VPA — no payment gateway, no merchant account, no API keys.
 * There's no webhook to auto-confirm payment this way, so it plugs into the
 * app's existing manual-reconciliation model (`paymentStatus: pending -> paid`).
 */
export interface UpiPayLinkParams {
  upiId: string;
  payeeName: string;
  amount: number;
  reference: string;
}

export function buildUpiPayLink({ upiId, payeeName, amount, reference }: UpiPayLinkParams): string {
  const params = [
    ['pa', upiId],
    ['pn', payeeName],
    ['am', amount.toFixed(2)],
    ['cu', 'INR'],
    ['tn', reference],
  ];

  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `upi://pay?${query}`;
}
