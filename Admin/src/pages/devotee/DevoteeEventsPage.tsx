import { useEffect } from 'react'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import { useGetTempleEventsQuery, useRegisterForEventMutation } from '@/services/api/endpoints/templeEventsApi'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGuestCheckout } from '@/features/devotee/hooks/useGuestCheckout'
import { GuestContactFields } from '@/features/devotee/components/GuestContactFields'
import { ScreenRenderer } from '@/components/screenBuilder/ScreenRenderer'
import { trackFunnelStep } from '@/utils/analytics'

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function DevoteeEventsPage() {
  const { t } = useDevoteeTranslation()
  const { showToast } = useToast()
  const { data: events = [], isLoading } = useGetTempleEventsQuery()
  const [registerForEvent, { isLoading: isRegistering }] = useRegisterForEventMutation()
  const guestCheckout = useGuestCheckout()

  useEffect(() => {
    trackFunnelStep('/devotee/events', 'event_registration', 0, 'viewed')
  }, [])

  const handleRegister = async (eventId: string, name: string) => {
    if (!guestCheckout.isGuestInfoValid) {
      showToast({ severity: 'warn', summary: t('devotee.eventsTitle'), detail: t('devotee.guestCheckoutNote') })
      return
    }

    try {
      await registerForEvent({ eventId, ...guestCheckout.guestPayload }).unwrap()
      trackFunnelStep('/devotee/events', 'event_registration', 1, 'submitted')
      showToast({ severity: 'success', summary: t('devotee.eventsTitle'), detail: name })
    } catch (error) {
      showToast({ severity: 'error', summary: t('devotee.eventsTitle'), detail: getApiErrorMessage(error) })
    }
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('devotee.eventsTitle')}</h1>
        <p>{t('devotee.eventsSubtitle')}</p>
      </div>

      <ScreenRenderer screenKey="events" />

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

      {isLoading && <p style={{ marginTop: 20 }}>{t('devotee.loading')}</p>}

      <div className="dp-grid dp-grid-3" style={{ marginTop: 20 }}>
        {events.map((event) => (
          <div className="dp-offer-card" key={event._id}>
            {event.imageUrl && (
              <div className="dp-offer-media">
                <img src={event.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div className="dp-offer-body">
              <h3>{event.name}</h3>
              <div className="meta">{formatEventDate(event.startDate)}</div>
              <p style={{ fontSize: 13, color: 'var(--dp-ink-soft)' }}>{event.description}</p>
            </div>
            <div className="dp-offer-foot">
              {event.registrationRequired ? (
                <button
                  type="button"
                  className="dp-small-btn filled"
                  disabled={isRegistering}
                  onClick={() => handleRegister(event._id, event.name)}
                >
                  {t('devotee.registerButton')}
                </button>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--dp-ink-soft)' }}>{t('devotee.openToAll')}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
