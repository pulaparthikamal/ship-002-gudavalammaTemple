import { useEffect, useMemo, useState } from 'react'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import { useCreatePrasadamOrderMutation, useGetPrasadamItemsQuery } from '@/services/api/endpoints/prasadamApi'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGuestCheckout } from '@/features/devotee/hooks/useGuestCheckout'
import { GuestContactFields } from '@/features/devotee/components/GuestContactFields'
import { ScreenRenderer } from '@/components/screenBuilder/ScreenRenderer'
import { UpiPaymentPanel } from '@/features/devotee/components/UpiPaymentPanel'
import { formatBookingHours } from '@/utils/bookingHours'
import { trackFunnelStep } from '@/utils/analytics'

export function DevoteePrasadamPage() {
  const { t } = useDevoteeTranslation()
  const { showToast } = useToast()
  const { data: items = [], isLoading } = useGetPrasadamItemsQuery()
  const [createOrder, { isLoading: isCheckingOut }] = useCreatePrasadamOrderMutation()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const guestCheckout = useGuestCheckout()
  const [paidBooking, setPaidBooking] = useState<{ refId: string; amount: number; reference: string } | null>(null)

  useEffect(() => {
    trackFunnelStep('/devotee/prasadam', 'prasadam_order', 0, 'viewed')
  }, [])

  const changeQty = (id: string, delta: number) => {
    setQuantities((prev) => {
      const wasEmpty = Object.values(prev).every((qty) => qty === 0)
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }
      if (wasEmpty && next[id] > 0) {
        trackFunnelStep('/devotee/prasadam', 'prasadam_order', 1, 'item_added')
      }
      return next
    })
  }

  const { totalItems, totalAmount } = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const qty = quantities[item._id] ?? 0
        return { totalItems: acc.totalItems + qty, totalAmount: acc.totalAmount + qty * item.price }
      },
      { totalItems: 0, totalAmount: 0 },
    )
  }, [items, quantities])

  const handleCheckout = async () => {
    if (totalItems === 0) {
      showToast({ severity: 'warn', summary: t('devotee.prasadamTitle'), detail: t('devotee.emptyCart') })
      return
    }

    if (!guestCheckout.isGuestInfoValid) {
      showToast({ severity: 'warn', summary: t('devotee.prasadamTitle'), detail: t('devotee.guestCheckoutNote') })
      return
    }

    const orderItems = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, qty }))

    try {
      const created = await createOrder({ items: orderItems, ...guestCheckout.guestPayload }).unwrap()
      trackFunnelStep('/devotee/prasadam', 'prasadam_order', 2, 'submitted')
      showToast({
        severity: 'success',
        summary: t('devotee.prasadamTitle'),
        detail: `${t('devotee.cartTotal')}: ₹${totalAmount.toLocaleString('en-IN')}`,
      })
      if (created.amount > 0) {
        setPaidBooking({ refId: created._id, amount: created.amount, reference: t('devotee.prasadamTitle') })
      }
      setQuantities({})
    } catch (error) {
      showToast({
        severity: 'error',
        summary: t('devotee.prasadamTitle'),
        detail: getApiErrorMessage(error, t('devotee.requestFailed')),
      })
    }
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('devotee.prasadamTitle')}</h1>
        <p>{t('devotee.prasadamSubtitle')}</p>
      </div>

      <ScreenRenderer screenKey="prasadam" />

      {paidBooking && (
        <UpiPaymentPanel refId={paidBooking.refId} amount={paidBooking.amount} reference={paidBooking.reference} />
      )}

      {isLoading && <p>{t('devotee.loading')}</p>}

      <div className="dp-grid dp-grid-4" style={{ marginTop: 20, marginBottom: 20 }}>
        {items.map((item) => (
          <div className="dp-offer-card" key={item._id}>
            <div className="dp-offer-media">
              <svg viewBox="0 0 24 24">
                <path d="M4 12a8 8 0 0016 0M4 12a8 8 0 018-8M4 12H2m18 0h2" />
              </svg>
            </div>
            <div className="dp-offer-body">
              <h3>{item.name}</h3>
              {formatBookingHours(item.bookingOpensAt, item.bookingClosesAt) && (
                <div className="meta" style={{ fontSize: 11 }}>
                  {t('devotee.bookingHoursLabel', {
                    hours: formatBookingHours(item.bookingOpensAt, item.bookingClosesAt)!,
                  })}
                </div>
              )}
              <div className="price">₹{item.price}</div>
            </div>
            <div className="dp-offer-foot">
              <div className="dp-qty-box">
                <button type="button" onClick={() => changeQty(item._id, -1)}>
                  –
                </button>
                <span>{quantities[item._id] ?? 0}</span>
                <button type="button" onClick={() => changeQty(item._id, 1)}>
                  +
                </button>
              </div>
              <span style={{ fontSize: 11, color: 'var(--dp-ink-soft)' }}>{t('devotee.perUnit')}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dp-panel" style={{ maxWidth: 340, marginLeft: 'auto' }}>
        <div className="dp-summary-row">
          <span>{t('devotee.cartItems')}</span>
          <span>{totalItems}</span>
        </div>
        <div className="dp-summary-row total">
          <span>{t('devotee.cartTotal')}</span>
          <span>₹{totalAmount.toLocaleString('en-IN')}</span>
        </div>

        {!guestCheckout.isAuthenticated && (
          <GuestContactFields
            guestName={guestCheckout.guestName}
            onGuestNameChange={guestCheckout.setGuestName}
            guestEmail={guestCheckout.guestEmail}
            onGuestEmailChange={guestCheckout.setGuestEmail}
            guestPhone={guestCheckout.guestPhone}
            onGuestPhoneChange={guestCheckout.setGuestPhone}
          />
        )}

        <button
          type="button"
          className="dp-btn-primary-pill"
          style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
          disabled={isCheckingOut}
          onClick={handleCheckout}
        >
          {t('devotee.checkoutButton')}
        </button>
      </div>
    </div>
  )
}
