import { useEffect, useState } from 'react'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import {
  useCreateAccommodationBookingMutation,
  useGetAccommodationRoomTypesQuery,
  type AccommodationRoomType,
} from '@/services/api/endpoints/accommodationApi'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGuestCheckout } from '@/features/devotee/hooks/useGuestCheckout'
import { GuestContactFields } from '@/features/devotee/components/GuestContactFields'
import { ScreenRenderer } from '@/components/screenBuilder/ScreenRenderer'
import { UpiPaymentPanel } from '@/features/devotee/components/UpiPaymentPanel'
import { formatBookingHours } from '@/utils/bookingHours'
import { trackFunnelStep } from '@/utils/analytics'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowIso() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function DevoteeAccommodationPage() {
  const { t } = useDevoteeTranslation()
  const { showToast } = useToast()
  const { data: stays = [], isLoading } = useGetAccommodationRoomTypesQuery()
  const [createBooking, { isLoading: isBooking }] = useCreateAccommodationBookingMutation()
  const guestCheckout = useGuestCheckout()

  const [selectedStay, setSelectedStay] = useState<AccommodationRoomType | null>(null)
  const [checkIn, setCheckIn] = useState(todayIso())
  const [checkOut, setCheckOut] = useState(tomorrowIso())
  const [guests, setGuests] = useState(1)
  const [paidBooking, setPaidBooking] = useState<{ refId: string; amount: number; reference: string } | null>(null)

  useEffect(() => {
    trackFunnelStep('/devotee/accommodation', 'accommodation_booking', 0, 'viewed')
  }, [])

  const handleBook = async () => {
    if (!selectedStay) return

    if (!guestCheckout.isGuestInfoValid) {
      showToast({ severity: 'warn', summary: t('devotee.accommodationTitle'), detail: t('devotee.guestCheckoutNote') })
      return
    }

    try {
      const created = await createBooking({
        roomTypeId: selectedStay._id,
        checkIn,
        checkOut,
        guests,
        ...guestCheckout.guestPayload,
      }).unwrap()
      trackFunnelStep('/devotee/accommodation', 'accommodation_booking', 2, 'submitted')
      showToast({ severity: 'success', summary: t('devotee.accommodationTitle'), detail: selectedStay.name })
      if (created.amount > 0) {
        setPaidBooking({ refId: created._id, amount: created.amount, reference: selectedStay.name })
      }
      setSelectedStay(null)
      setGuests(1)
    } catch (error) {
      showToast({
        severity: 'error',
        summary: t('devotee.accommodationTitle'),
        detail: getApiErrorMessage(error, t('devotee.requestFailed')),
      })
    }
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('devotee.accommodationTitle')}</h1>
        <p>{t('devotee.accommodationSubtitle')}</p>
      </div>

      <ScreenRenderer screenKey="accommodation" />

      {paidBooking && (
        <UpiPaymentPanel refId={paidBooking.refId} amount={paidBooking.amount} reference={paidBooking.reference} />
      )}

      {isLoading && <p>{t('devotee.loading')}</p>}

      <div className="dp-grid dp-grid-4" style={{ marginTop: 20 }}>
        {stays.map((stay) => (
          <div className="dp-offer-card" key={stay._id}>
            <div className="dp-offer-media">
              <svg viewBox="0 0 24 24">
                <path d="M3 21V9l9-6 9 6v12M9 21v-6h6v6" />
              </svg>
            </div>
            <div className="dp-offer-body">
              <h3>{stay.name}</h3>
              <div className="meta">{stay.detail}</div>
              {formatBookingHours(stay.bookingOpensAt, stay.bookingClosesAt) && (
                <div className="meta" style={{ fontSize: 11 }}>
                  {t('devotee.bookingHoursLabel', {
                    hours: formatBookingHours(stay.bookingOpensAt, stay.bookingClosesAt)!,
                  })}
                </div>
              )}
              <div className="price">
                {stay.pricePerNight === 0 ? t('devotee.free') : `₹${stay.pricePerNight.toLocaleString('en-IN')}${t('devotee.perNight')}`}
              </div>
            </div>
            <div className="dp-offer-foot">
              <span style={{ fontSize: 11, color: 'var(--dp-ink-soft)' }}>{t('devotee.availabilityNote')}</span>
              <button
                type="button"
                className="dp-small-btn filled"
                onClick={() => {
                  setSelectedStay(stay)
                  trackFunnelStep('/devotee/accommodation', 'accommodation_booking', 1, 'stay_selected')
                }}
              >
                {t('devotee.bookStay')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedStay && (
        <div className="dp-panel" style={{ maxWidth: 420, marginTop: 20 }}>
          <h3 style={{ marginTop: 0 }}>{selectedStay.name}</h3>

          <div className="dp-summary-row" style={{ gap: 8 }}>
            <label htmlFor="dp-checkin" style={{ fontSize: 13 }}>
              {t('devotee.checkInLabel')}
            </label>
            <input
              id="dp-checkin"
              type="date"
              value={checkIn}
              min={todayIso()}
              onChange={(event) => setCheckIn(event.target.value)}
            />
          </div>

          <div className="dp-summary-row" style={{ gap: 8 }}>
            <label htmlFor="dp-checkout" style={{ fontSize: 13 }}>
              {t('devotee.checkOutLabel')}
            </label>
            <input
              id="dp-checkout"
              type="date"
              value={checkOut}
              min={checkIn}
              onChange={(event) => setCheckOut(event.target.value)}
            />
          </div>

          <div className="dp-stepper">
            <span style={{ fontSize: 13 }}>{t('devotee.guestsLabel')}</span>
            <button type="button" onClick={() => setGuests((count) => Math.max(1, count - 1))}>
              –
            </button>
            <span style={{ fontFamily: 'var(--dp-font-body)', fontWeight: 700 }}>{guests}</span>
            <button type="button" onClick={() => setGuests((count) => Math.min(10, count + 1))}>
              +
            </button>
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
            disabled={isBooking}
            onClick={handleBook}
          >
            {t('devotee.bookStay')}
          </button>
        </div>
      )}
    </div>
  )
}
