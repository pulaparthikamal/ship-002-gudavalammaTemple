import { useEffect, useState } from 'react'
import type { SevaCategory } from '@/services/api/endpoints/sevaApi'
import { useCreateSevaBookingMutation, useGetSevasQuery } from '@/services/api/endpoints/sevaApi'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGuestCheckout } from '@/features/devotee/hooks/useGuestCheckout'
import { GuestContactFields } from '@/features/devotee/components/GuestContactFields'
import { ScreenRenderer } from '@/components/screenBuilder/ScreenRenderer'
import { UpiPaymentPanel } from '@/features/devotee/components/UpiPaymentPanel'
import { formatBookingHours } from '@/utils/bookingHours'
import { trackFunnelStep } from '@/utils/analytics'

const CATEGORIES: {
  id: SevaCategory
  nameKey: 'devotee.categoryParoksha' | 'devotee.categoryPratyaksha' | 'devotee.categorySaswata'
  descKey: 'devotee.categoryParokshaDesc' | 'devotee.categoryPratyakshaDesc' | 'devotee.categorySaswataDesc'
}[] = [
  { id: 'pratyaksha', nameKey: 'devotee.categoryPratyaksha', descKey: 'devotee.categoryPratyakshaDesc' },
  { id: 'paroksha', nameKey: 'devotee.categoryParoksha', descKey: 'devotee.categoryParokshaDesc' },
  { id: 'saswata', nameKey: 'devotee.categorySaswata', descKey: 'devotee.categorySaswataDesc' },
]

export function DevoteeSevaPage() {
  const { t } = useDevoteeTranslation()
  const { showToast } = useToast()
  const { data: sevas = [] } = useGetSevasQuery()
  const [createSevaBooking, { isLoading: isBooking }] = useCreateSevaBookingMutation()
  const guestCheckout = useGuestCheckout()
  const [paidBooking, setPaidBooking] = useState<{ refId: string; amount: number; reference: string } | null>(null)

  useEffect(() => {
    trackFunnelStep('/devotee/seva', 'seva_booking', 0, 'viewed')
  }, [])

  const handleBook = async (sevaId: string, name: string) => {
    if (!guestCheckout.isGuestInfoValid) {
      showToast({ severity: 'warn', summary: t('devotee.sevaTitle'), detail: t('devotee.guestCheckoutNote') })
      return
    }

    try {
      const created = await createSevaBooking({ sevaId, ...guestCheckout.guestPayload }).unwrap()
      trackFunnelStep('/devotee/seva', 'seva_booking', 1, 'submitted')
      showToast({ severity: 'success', summary: t('devotee.sevaTitle'), detail: name })
      if (created.amount > 0) {
        setPaidBooking({ refId: created._id, amount: created.amount, reference: name })
      }
    } catch (error) {
      showToast({ severity: 'error', summary: t('devotee.sevaTitle'), detail: getApiErrorMessage(error) })
    }
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('devotee.sevaTitle')}</h1>
        <p>{t('devotee.sevaSubtitle')}</p>
      </div>

      <ScreenRenderer screenKey="seva" />

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

      {paidBooking && (
        <UpiPaymentPanel refId={paidBooking.refId} amount={paidBooking.amount} reference={paidBooking.reference} />
      )}

      {CATEGORIES.map((category) => (
        <section key={category.id}>
          <div className="dp-sec-title">
            {t(category.nameKey)}
            <span className={`dp-badge ${category.id}`}>{category.id}</span>
          </div>
          <p style={{ color: 'var(--dp-ink-soft)', fontSize: 13, marginTop: -8, marginBottom: 14 }}>{t(category.descKey)}</p>
          <div className="dp-grid dp-grid-4">
            {sevas
              .filter((seva) => seva.category === category.id)
              .map((seva) => (
                <div className="dp-offer-card" key={seva._id}>
                  <div className="dp-offer-media">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 22c0-4 4-6 8-6s8 2 8 6" />
                    </svg>
                  </div>
                  <div className="dp-offer-body">
                    <h3>{seva.name}</h3>
                    <div className="meta">{seva.timing}</div>
                    {formatBookingHours(seva.bookingOpensAt, seva.bookingClosesAt) && (
                      <div className="meta" style={{ fontSize: 11 }}>
                        {t('devotee.bookingHoursLabel', {
                          hours: formatBookingHours(seva.bookingOpensAt, seva.bookingClosesAt)!,
                        })}
                      </div>
                    )}
                    <div className="price">
                      ₹{seva.price.toLocaleString('en-IN')}
                      {category.id === 'saswata' ? ` (${t('devotee.oneTime')})` : ''}
                    </div>
                  </div>
                  <div className="dp-offer-foot">
                    <span style={{ fontSize: 11, color: 'var(--dp-ink-soft)' }}>{t('devotee.limitedSlots')}</span>
                    <button
                      type="button"
                      className="dp-small-btn filled"
                      disabled={isBooking}
                      onClick={() => handleBook(seva._id, seva.name)}
                    >
                      {t('devotee.bookSeva')}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
