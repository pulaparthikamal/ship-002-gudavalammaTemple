import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { selectCurrentUser, selectIsAuthenticated } from '@/features/auth/authSlice'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useAppSelector } from '@/hooks/redux'
import { AnnouncementPopup } from '@/components/AnnouncementPopup'
import { ScreenRenderer } from '@/components/screenBuilder/ScreenRenderer'
import { useGetTempleEventsQuery } from '@/services/api/endpoints/templeEventsApi'
import { useGetTempleProfileQuery } from '@/services/api/endpoints/templeProfileApi'
import { resolveTempleName } from '@/utils/templeName'
import { trackClick } from '@/utils/analytics'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import gudavalammaDeviImage from '@/assets/gudavalamma-devi.webp'

function useCountUp(target: number, durationMs: number) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let frame: number
    const start = performance.now()

    const step = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1)
      setValue(Math.floor(progress * target))
      if (progress < 1) {
        frame = requestAnimationFrame(step)
      }
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return value
}

function useCountdownTo(targetTime: number | null) {
  const targetRef = useRef<number | null>(targetTime)
  const [remaining, setRemaining] = useState(targetTime ? targetTime - Date.now() : 0)

  useEffect(() => {
    targetRef.current = targetTime
    setRemaining(targetTime ? targetTime - Date.now() : 0)

    const interval = setInterval(() => {
      if (targetRef.current !== null) {
        setRemaining(targetRef.current - Date.now())
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [targetTime])

  const clamped = Math.max(remaining, 0)
  return {
    days: Math.floor(clamped / 86400000),
    hours: Math.floor(clamped / 3600000) % 24,
    minutes: Math.floor(clamped / 60000) % 60,
    seconds: Math.floor(clamped / 1000) % 60,
  }
}

export function DevoteeDashboardPage() {
  const { t, language } = useDevoteeTranslation()
  const user = useAppSelector(selectCurrentUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const queueWait = useCountUp(45, 1200)
  const queueDevotees = useCountUp(12480, 1600)
  const { data: events = [] } = useGetTempleEventsQuery()
  const { data: templeProfile } = useGetTempleProfileQuery()

  const nextEvent = useMemo(() => {
    const now = Date.now()
    return events
      .filter((event) => new Date(event.startDate).getTime() >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0]
  }, [events])

  const countdown = useCountdownTo(nextEvent ? new Date(nextEvent.startDate).getTime() : null)

  const quickActions: {
    to: string
    icon: string
    titleKey:
      | 'devotee.darshanCardTitle'
      | 'devotee.sevaCardTitle'
      | 'devotee.accommodationCardTitle'
      | 'devotee.prasadamCardTitle'
      | 'devotee.donationCardTitle'
      | 'devotee.liveCardTitle'
      | 'devotee.bookingsCardTitle'
      | 'devotee.facilitiesCardTitle'
      | 'devotee.eventsCardTitle'
      | 'devotee.nearbyPlacesCardTitle'
    descKey:
      | 'devotee.darshanCardDesc'
      | 'devotee.sevaCardDesc'
      | 'devotee.accommodationCardDesc'
      | 'devotee.prasadamCardDesc'
      | 'devotee.donationCardDesc'
      | 'devotee.liveCardDesc'
      | 'devotee.bookingsCardDesc'
      | 'devotee.facilitiesCardDesc'
      | 'devotee.eventsCardDesc'
      | 'devotee.nearbyPlacesCardDesc'
    trackLabel: string
  }[] = [
    { to: '/devotee/darshan', icon: 'M12 2v20M4 12h16', titleKey: 'devotee.darshanCardTitle', descKey: 'devotee.darshanCardDesc', trackLabel: 'quickaction_darshan' },
    { to: '/devotee/seva', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM4 22c0-4 4-6 8-6s8 2 8 6', titleKey: 'devotee.sevaCardTitle', descKey: 'devotee.sevaCardDesc', trackLabel: 'quickaction_seva' },
    { to: '/devotee/accommodation', icon: 'M3 21V9l9-6 9 6v12M9 21v-6h6v6', titleKey: 'devotee.accommodationCardTitle', descKey: 'devotee.accommodationCardDesc', trackLabel: 'quickaction_accommodation' },
    { to: '/devotee/prasadam', icon: 'M4 12a8 8 0 0016 0M4 12a8 8 0 018-8M4 12H2m18 0h2', titleKey: 'devotee.prasadamCardTitle', descKey: 'devotee.prasadamCardDesc', trackLabel: 'quickaction_prasadam' },
    { to: '/devotee/donations', icon: 'M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5 9 5 11 7 12 8c1-1 3-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.65 12 21 12 21z', titleKey: 'devotee.donationCardTitle', descKey: 'devotee.donationCardDesc', trackLabel: 'quickaction_donations' },
    { to: '/devotee/events', icon: 'M8 7V3m8 4V3M3 11h18M5 7h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z', titleKey: 'devotee.eventsCardTitle', descKey: 'devotee.eventsCardDesc', trackLabel: 'quickaction_events' },
    { to: '/devotee/live', icon: 'M3 5h18v14H3zM8 21h8', titleKey: 'devotee.liveCardTitle', descKey: 'devotee.liveCardDesc', trackLabel: 'quickaction_live' },
    { to: '/devotee/bookings', icon: 'M20 12a8 8 0 11-8-8M12 4v8l6 3', titleKey: 'devotee.bookingsCardTitle', descKey: 'devotee.bookingsCardDesc', trackLabel: 'quickaction_bookings' },
    { to: '/devotee/facilities', icon: 'M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z', titleKey: 'devotee.facilitiesCardTitle', descKey: 'devotee.facilitiesCardDesc', trackLabel: 'quickaction_facilities' },
    { to: '/devotee/nearby-places', icon: 'M12 21c-4.5-4.5-7-8.25-7-11.5A7 7 0 0119 9.5c0 3.25-2.5 7-7 11.5zM12 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', titleKey: 'devotee.nearbyPlacesCardTitle', descKey: 'devotee.nearbyPlacesCardDesc', trackLabel: 'quickaction_nearby_places' },
  ]

  const schedule = templeProfile?.timings ?? []
  const heroDeityImage = templeProfile?.deityImageUrl ? resolveApiAssetUrl(templeProfile.deityImageUrl) : gudavalammaDeviImage

  return (
    <div className="dp-page">
      <AnnouncementPopup />
      <ScreenRenderer screenKey="home" />

      {isAuthenticated ? (
        <>
          <div className="dp-page-head">
            <h1>
              🙏 {t('devotee.welcomeBack')}
              {user?.name ? `, ${user.name}` : ''}
            </h1>
          </div>

          <div className="dp-sec-title">{t('devotee.quickActionsTitle')}</div>
          <div className="dp-grid dp-grid-4">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="dp-tilt-card"
                onClick={() => trackClick('/', action.trackLabel)}
              >
                <div className="dp-icon-wrap">
                  <svg viewBox="0 0 24 24">
                    <path d={action.icon} strokeLinecap="round" />
                  </svg>
                </div>
                <h3>{t(action.titleKey)}</h3>
                <p>{t(action.descKey)}</p>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="dp-home-hero">
          <h1>🙏 {t('devotee.homeHeroTitle', { templeName: resolveTempleName(templeProfile, language, t('devotee.appName')) })}</h1>
          <div className="dp-hero-deity-wrap">
            <img
              className="dp-hero-deity"
              src={heroDeityImage}
              alt={resolveTempleName(templeProfile, language, t('devotee.appName'))}
            />
          </div>
          <p>{t('devotee.homeHeroSubtitle')}</p>
          <div className="dp-home-hero-actions">
            <Link to="/devotee/login" className="dp-cta-btn dp-cta-btn-primary">
              {t('devotee.homeDevoteeLoginCta')}
            </Link>
            <Link to="/login" className="dp-cta-btn">
              {t('devotee.homeStaffLoginCta')}
            </Link>
          </div>
        </div>
      )}

      <div className="dp-sec-title">{t('devotee.liveRightNowTitle')}</div>
      <div className="dp-grid dp-grid-3">
        <div className="dp-stat-card">
          <div className="dp-stat-label">{t('devotee.queueWaitLabel')}</div>
          <div className="dp-stat-num">
            {queueWait} {t('devotee.queueWaitUnit')}
          </div>
          <div className="dp-stat-sub">
            ≈ {queueDevotees.toLocaleString('en-IN')} {t('devotee.queueDevoteesLabel')}
          </div>
        </div>
        <div className="dp-stat-card">
          <div className="dp-stat-label">
            {t('devotee.nextFestivalLabel')} · {nextEvent ? nextEvent.name : t('devotee.noUpcomingEvents')}
          </div>
          {nextEvent && (
            <div className="dp-countdown">
              <div>
                <div className="n">{String(countdown.days).padStart(2, '0')}</div>
                <div className="l">{t('devotee.countdownDays')}</div>
              </div>
              <div>
                <div className="n">{String(countdown.hours).padStart(2, '0')}</div>
                <div className="l">{t('devotee.countdownHours')}</div>
              </div>
              <div>
                <div className="n">{String(countdown.minutes).padStart(2, '0')}</div>
                <div className="l">{t('devotee.countdownMinutes')}</div>
              </div>
              <div>
                <div className="n">{String(countdown.seconds).padStart(2, '0')}</div>
                <div className="l">{t('devotee.countdownSeconds')}</div>
              </div>
            </div>
          )}
        </div>
        <div className="dp-stat-card">
          <div className="dp-stat-label">{t('devotee.todayScheduleTitle')}</div>
          {schedule.map((item) => (
            <div key={item.label} className="dp-sched-item">
              <span>{item.label}</span>
              <span>{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
