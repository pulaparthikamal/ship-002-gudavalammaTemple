/**
 * Builds a standard UPI deep link (`upi://pay?...`), per the publicly
 * documented NPCI UPI linking spec — mirrors server/src/utils/upi.util.ts.
 * Opens the payer's own UPI app (GPay/PhonePe/Paytm/BHIM/etc.) for a direct
 * bank-to-bank transfer straight to the temple's own VPA. No gateway, no
 * webhook — payment confirmation stays manual, same as the existing
 * pending -> paid staff reconciliation flow.
 */
export interface UpiPayLinkParams {
  upiId: string
  payeeName: string
  amount: number
  reference: string
}

export function buildUpiPayLink({ upiId, payeeName, amount, reference }: UpiPayLinkParams): string {
  const params = [
    ['pa', upiId],
    ['pn', payeeName],
    ['am', amount.toFixed(2)],
    ['cu', 'INR'],
    ['tn', reference],
  ] as const

  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
  return `upi://pay?${query}`
}
