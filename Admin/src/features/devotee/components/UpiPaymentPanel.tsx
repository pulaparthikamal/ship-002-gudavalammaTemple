import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGetTempleProfileQuery } from '@/services/api/endpoints/templeProfileApi'
import { useSubmitBookingPaymentReferenceMutation } from '@/services/api/endpoints/bookingApi'
import { buildUpiPayLink } from '@/utils/upi'

interface UpiPaymentPanelProps {
  /** The just-created booking/order/donation's own `_id` — matches `Booking.refId`
   * on the shared ledger, so no separate lookup/auth is needed to submit a UTR. */
  refId: string
  amount: number
  reference: string
}

/**
 * Shown right after a paid booking/order/donation is created. Direct UPI
 * bank-to-bank transfer — no payment gateway, no account/API keys. There's
 * no webhook to auto-confirm payment, so this plugs into the app's existing
 * manual-reconciliation model: the devotee optionally submits the UTR shown
 * in their own UPI app, and staff confirm it against the temple's bank
 * statement before marking the booking paid.
 */
export function UpiPaymentPanel({ refId, amount, reference }: UpiPaymentPanelProps) {
  const { t } = useDevoteeTranslation()
  const { showToast } = useToast()
  const { data: templeProfile } = useGetTempleProfileQuery()
  const [submitPaymentReference, { isLoading: isSubmitting }] = useSubmitBookingPaymentReferenceMutation()
  const [utr, setUtr] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const upiId = templeProfile?.upiId
  const payLink =
    upiId && amount > 0
      ? buildUpiPayLink({ upiId, payeeName: templeProfile?.templeName || 'Temple', amount, reference })
      : null

  useEffect(() => {
    if (!payLink) {
      setQrDataUrl(null)
      return
    }

    let cancelled = false
    QRCode.toDataURL(payLink, { width: 220, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [payLink])

  if (!payLink) {
    return null
  }

  const handleSubmitUtr = async () => {
    if (!utr.trim()) return
    try {
      await submitPaymentReference({ refId, paymentReference: utr.trim() }).unwrap()
      setSubmitted(true)
      showToast({ severity: 'success', summary: t('devotee.upiReferenceSubmitted') })
    } catch (error) {
      showToast({ severity: 'error', summary: t('devotee.upiTitle'), detail: getApiErrorMessage(error) })
    }
  }

  return (
    <div className="dp-panel" style={{ marginTop: 16 }}>
      <div className="dp-sec-title" style={{ marginTop: 0 }}>
        {t('devotee.upiTitle')}
      </div>
      <p style={{ fontSize: 13, color: 'var(--dp-ink-soft)', marginBottom: 12 }}>
        {t('devotee.upiSubtitle', { amount: amount.toLocaleString('en-IN') })}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt={t('devotee.upiQrAlt')}
            width={140}
            height={140}
            style={{ borderRadius: 8, border: '1px solid var(--dp-border, #e5d9c8)' }}
          />
        )}
        <a
          href={payLink}
          className="dp-btn-primary-pill"
          style={{ textDecoration: 'none', display: 'inline-flex' }}
        >
          {t('devotee.upiPayNow')}
        </a>
      </div>

      {submitted ? (
        <p style={{ fontSize: 13, marginTop: 12, color: 'var(--dp-ink-soft)' }}>
          {t('devotee.upiReferenceSubmitted')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <input
            className="dp-input"
            style={{ flex: '1 1 220px' }}
            placeholder={t('devotee.upiReferencePlaceholder')}
            value={utr}
            onChange={(event) => setUtr(event.target.value)}
          />
          <button
            type="button"
            className="dp-btn-primary-pill"
            disabled={isSubmitting || !utr.trim()}
            onClick={() => void handleSubmitUtr()}
          >
            {t('devotee.upiSubmitReference')}
          </button>
        </div>
      )}
    </div>
  )
}
