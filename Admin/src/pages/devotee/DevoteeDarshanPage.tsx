import { useEffect, useMemo, useState } from 'react'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import { useCreateDarshanBookingMutation, useGetDarshanQuotasQuery } from '@/services/api/endpoints/darshanApi'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGuestCheckout } from '@/features/devotee/hooks/useGuestCheckout'
import { GuestContactFields } from '@/features/devotee/components/GuestContactFields'
import { ScreenRenderer } from '@/components/screenBuilder/ScreenRenderer'
import { UpiPaymentPanel } from '@/features/devotee/components/UpiPaymentPanel'
import { formatBookingHours } from '@/utils/bookingHours'
import { trackFunnelStep } from '@/utils/analytics'

type QuotaSlug = 'sarva' | 'special' | 'senior'

const QUOTA_META: Record<
  QuotaSlug,
  {
    nameKey: 'devotee.quotaSarvaName' | 'devotee.quotaSpecialName' | 'devotee.quotaSeniorName'
    descKey: 'devotee.quotaSarvaDesc' | 'devotee.quotaSpecialDesc' | 'devotee.quotaSeniorDesc'
  }
> = {
  sarva: { nameKey: 'devotee.quotaSarvaName', descKey: 'devotee.quotaSarvaDesc' },
  special: { nameKey: 'devotee.quotaSpecialName', descKey: 'devotee.quotaSpecialDesc' },
  senior: { nameKey: 'devotee.quotaSeniorName', descKey: 'devotee.quotaSeniorDesc' },
}

const QUOTA_ORDER: QuotaSlug[] = ['sarva', 'special', 'senior']

interface DisplayQuota {
  id: string
  slug: string
  nameKey: 'devotee.quotaSarvaName' | 'devotee.quotaSpecialName' | 'devotee.quotaSeniorName'
  descKey: 'devotee.quotaSarvaDesc' | 'devotee.quotaSpecialDesc' | 'devotee.quotaSeniorDesc'
  price: number
  bookingOpensAt?: string
  bookingClosesAt?: string
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { firstDay, daysInMonth }
}

const LOCALE_MAP: Record<string, string> = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' }
const resolveDateLocale = (language: string): string => LOCALE_MAP[language] ?? 'en-IN'

export function DevoteeDarshanPage() {
  const { t, language } = useDevoteeTranslation()
  const { showToast } = useToast()
  const now = useMemo(() => new Date(), [])
  const { firstDay, daysInMonth } = buildCalendarDays(now.getFullYear(), now.getMonth())

  const { data: quotas = [] } = useGetDarshanQuotasQuery()
  const [createDarshanBooking, { isLoading: isBooking }] = useCreateDarshanBookingMutation()
  const guestCheckout = useGuestCheckout()

  const displayQuotas = useMemo<DisplayQuota[]>(() => {
    return QUOTA_ORDER.map((slug) => {
      const match = quotas.find((quota) => quota.slug === slug)
      const meta = QUOTA_META[slug]
      return {
        id: match?._id ?? slug,
        slug,
        nameKey: meta.nameKey,
        descKey: meta.descKey,
        price: match?.price ?? 0,
        bookingOpensAt: match?.bookingOpensAt,
        bookingClosesAt: match?.bookingClosesAt,
      }
    }).filter((quota) => quotas.length === 0 || quotas.some((q) => q.slug === quota.slug))
  }, [quotas])

  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedQuotaSlug, setSelectedQuotaSlug] = useState<QuotaSlug>('sarva')
  const [devoteeCount, setDevoteeCount] = useState(2)
  const [paidBooking, setPaidBooking] = useState<{ refId: string; amount: number; reference: string } | null>(null)

  useEffect(() => {
    trackFunnelStep('/devotee/darshan', 'darshan_booking', 0, 'viewed')
  }, [])

  useEffect(() => {
    if (displayQuotas.length > 0 && !displayQuotas.some((q) => q.slug === selectedQuotaSlug)) {
      setSelectedQuotaSlug(displayQuotas[0].slug as QuotaSlug)
    }
  }, [displayQuotas, selectedQuotaSlug])

  const selectedQuota = displayQuotas.find((q) => q.slug === selectedQuotaSlug) ?? displayQuotas[0]

  const monthLabel = now.toLocaleDateString(resolveDateLocale(language), { month: 'long', year: 'numeric' })
  const selectedDateLabel =
    selectedDay !== null ? `${selectedDay} ${now.toLocaleDateString(resolveDateLocale(language), { month: 'short' })}` : t('devotee.noDateSelected')
  const total = (selectedQuota?.price ?? 0) * devoteeCount

  const dayOfWeekLabels = useMemo(() => {
    const base = new Date(2024, 0, 7) // a Sunday
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(base)
      d.setDate(base.getDate() + index)
      return d.toLocaleDateString(resolveDateLocale(language), { weekday: 'short' }).slice(0, 1)
    })
  }, [language])

  const handleConfirm = async () => {
    if (selectedDay === null) {
      showToast({ severity: 'warn', summary: t('devotee.darshanTitle'), detail: t('devotee.selectDateFirst') })
      return
    }

    if (!selectedQuota) {
      return
    }

    if (!guestCheckout.isGuestInfoValid) {
      showToast({ severity: 'warn', summary: t('devotee.darshanTitle'), detail: t('devotee.guestCheckoutNote') })
      return
    }

    const bookingDate = new Date(now.getFullYear(), now.getMonth(), selectedDay).toISOString()

    try {
      const created = await createDarshanBooking({
        quotaId: selectedQuota.id,
        date: bookingDate,
        devoteeCount,
        ...guestCheckout.guestPayload,
      }).unwrap()

      trackFunnelStep('/devotee/darshan', 'darshan_booking', 2, 'submitted')
      showToast({
        severity: 'success',
        summary: t('devotee.darshanTitle'),
        detail: `${selectedDateLabel} · ${t(selectedQuota.nameKey)} · ${devoteeCount}`,
      })
      if (created.amount > 0) {
        setPaidBooking({ refId: created._id, amount: created.amount, reference: t(selectedQuota.nameKey) })
      }
    } catch (error) {
      showToast({ severity: 'error', summary: t('devotee.darshanTitle'), detail: getApiErrorMessage(error) })
    }
  }

  const cells: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('devotee.darshanTitle')}</h1>
        <p>{t('devotee.darshanSubtitle')}</p>
      </div>

      <ScreenRenderer screenKey="darshan" />

      <div className="dp-booking-layout" style={{ marginTop: 20 }}>
        <div className="dp-panel">
          <div className="dp-cal-head">
            <span>📅</span>
            <span>{monthLabel}</span>
          </div>
          <div className="dp-cal-grid">
            {dayOfWeekLabels.map((label, index) => (
              <div className="dow" key={`${label}-${index}`}>
                {label}
              </div>
            ))}
            {cells.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} />
              }
              const isPast = day < now.getDate()
              const isToday = day === now.getDate()
              const isSelected = day === selectedDay
              return (
                <div
                  key={day}
                  className={[
                    'dp-cal-day',
                    isPast ? 'disabled' : '',
                    isToday ? 'today' : '',
                    isSelected ? 'selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    if (isPast) return
                    setSelectedDay(day)
                    trackFunnelStep('/devotee/darshan', 'darshan_booking', 1, 'date_selected')
                  }}
                >
                  {day}
                </div>
              )
            })}
          </div>
        </div>

        <div className="dp-panel">
          {displayQuotas.map((quota) => (
            <div
              key={quota.slug}
              className={`dp-quota-card ${selectedQuotaSlug === quota.slug ? 'active' : ''}`}
              onClick={() => setSelectedQuotaSlug(quota.slug as QuotaSlug)}
            >
              <div>
                <div className="qname">{t(quota.nameKey)}</div>
                <div className="qdesc">{t(quota.descKey)}</div>
                {formatBookingHours(quota.bookingOpensAt, quota.bookingClosesAt) && (
                  <div className="qdesc" style={{ fontSize: 11 }}>
                    {t('devotee.bookingHoursLabel', {
                      hours: formatBookingHours(quota.bookingOpensAt, quota.bookingClosesAt)!,
                    })}
                  </div>
                )}
              </div>
              <div className="qprice">{quota.price === 0 ? t('devotee.free') : `₹${quota.price}`}</div>
            </div>
          ))}

          <div className="dp-stepper">
            <span style={{ fontSize: 13 }}>{t('devotee.devoteesLabel')}</span>
            <button type="button" onClick={() => setDevoteeCount((count) => Math.max(1, count - 1))}>
              –
            </button>
            <span style={{ fontFamily: 'var(--dp-font-body)', fontWeight: 700 }}>{devoteeCount}</span>
            <button type="button" onClick={() => setDevoteeCount((count) => Math.min(5, count + 1))}>
              +
            </button>
            <span style={{ fontSize: '11.5px', color: 'var(--dp-ink-soft)' }}>{t('devotee.maxNote')}</span>
          </div>

          <div className="dp-summary-row">
            <span>{t('devotee.selectedDateLabel')}</span>
            <span>{selectedDateLabel}</span>
          </div>
          <div className="dp-summary-row">
            <span>{t('devotee.quotaLabel')}</span>
            <span>{selectedQuota ? t(selectedQuota.nameKey) : ''}</span>
          </div>
          <div className="dp-summary-row total">
            <span>{t('devotee.totalLabel')}</span>
            <span>₹{total.toLocaleString('en-IN')}</span>
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
            onClick={handleConfirm}
            disabled={isBooking}
          >
            {t('devotee.proceedButton')}
          </button>

          {paidBooking && (
            <UpiPaymentPanel
              refId={paidBooking.refId}
              amount={paidBooking.amount}
              reference={paidBooking.reference}
            />
          )}
        </div>
      </div>
    </div>
  )
}
