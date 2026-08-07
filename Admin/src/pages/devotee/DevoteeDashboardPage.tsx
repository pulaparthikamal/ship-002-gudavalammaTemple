import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import { useAppSelector } from '@/hooks/redux'

const FESTIVAL_DAYS_AHEAD = 47

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

function useFestivalCountdown() {
  const targetRef = useRef<number | null>(null)
  const [remaining, setRemaining] = useState(FESTIVAL_DAYS_AHEAD * 86400000)

  useEffect(() => {
    targetRef.current = Date.now() + FESTIVAL_DAYS_AHEAD * 86400000
    setRemaining(targetRef.current - Date.now())

    const interval = setInterval(() => {
      if (targetRef.current !== null) {
        setRemaining(targetRef.current - Date.now())
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const clamped = Math.max(remaining, 0)
  return {
    days: Math.floor(clamped / 86400000),
    hours: Math.floor(clamped / 3600000) % 24,
    minutes: Math.floor(clamped / 60000) % 60,
    seconds: Math.floor(clamped / 1000) % 60,
  }
}

export function DevoteeDashboardPage() {
  const { t } = useDevoteeLanguage()
  const user = useAppSelector(selectCurrentUser)
  const queueWait = useCountUp(45, 1200)
  const queueDevotees = useCountUp(12480, 1600)
  const countdown = useFestivalCountdown()

  const quickActions: { to: string; icon: string; titleKey: 'darshanCardTitle' | 'sevaCardTitle' | 'accommodationCardTitle' | 'prasadamCardTitle' | 'donationCardTitle' | 'liveCardTitle' | 'bookingsCardTitle' | 'facilitiesCardTitle'; descKey: 'darshanCardDesc' | 'sevaCardDesc' | 'accommodationCardDesc' | 'prasadamCardDesc' | 'donationCardDesc' | 'liveCardDesc' | 'bookingsCardDesc' | 'facilitiesCardDesc' }[] = [
    { to: '/devotee/darshan', icon: 'M12 2v20M4 12h16', titleKey: 'darshanCardTitle', descKey: 'darshanCardDesc' },
    { to: '/devotee/seva', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM4 22c0-4 4-6 8-6s8 2 8 6', titleKey: 'sevaCardTitle', descKey: 'sevaCardDesc' },
    { to: '/devotee/accommodation', icon: 'M3 21V9l9-6 9 6v12M9 21v-6h6v6', titleKey: 'accommodationCardTitle', descKey: 'accommodationCardDesc' },
    { to: '/devotee/prasadam', icon: 'M4 12a8 8 0 0016 0M4 12a8 8 0 018-8M4 12H2m18 0h2', titleKey: 'prasadamCardTitle', descKey: 'prasadamCardDesc' },
    { to: '/devotee/donations', icon: 'M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5 9 5 11 7 12 8c1-1 3-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.65 12 21 12 21z', titleKey: 'donationCardTitle', descKey: 'donationCardDesc' },
    { to: '/devotee/live', icon: 'M3 5h18v14H3zM8 21h8', titleKey: 'liveCardTitle', descKey: 'liveCardDesc' },
    { to: '/devotee/bookings', icon: 'M20 12a8 8 0 11-8-8M12 4v8l6 3', titleKey: 'bookingsCardTitle', descKey: 'bookingsCardDesc' },
    { to: '/devotee/facilities', icon: 'M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z', titleKey: 'facilitiesCardTitle', descKey: 'facilitiesCardDesc' },
  ]

  const schedule: { labelKey: 'scheduleSuprabhatam' | 'scheduleSarvaDarshan' | 'scheduleArchana' | 'scheduleEkanta'; time: string }[] = [
    { labelKey: 'scheduleSuprabhatam', time: '4:30 AM' },
    { labelKey: 'scheduleSarvaDarshan', time: '6:00 AM – 9:00 PM' },
    { labelKey: 'scheduleArchana', time: '7:00 – 10:00 AM' },
    { labelKey: 'scheduleEkanta', time: '9:15 PM' },
  ]

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>
          🙏 {t('welcomeBack')}
          {user?.name ? `, ${user.name}` : ''}
        </h1>
      </div>

      <div className="dp-sec-title">{t('quickActionsTitle')}</div>
      <div className="dp-grid dp-grid-4">
        {quickActions.map((action) => (
          <Link key={action.to} to={action.to} className="dp-tilt-card">
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

      <div className="dp-sec-title">{t('liveRightNowTitle')}</div>
      <div className="dp-grid dp-grid-3">
        <div className="dp-stat-card">
          <div className="dp-stat-label">{t('queueWaitLabel')}</div>
          <div className="dp-stat-num">
            {queueWait} {t('queueWaitUnit')}
          </div>
          <div className="dp-stat-sub">
            ≈ {queueDevotees.toLocaleString('en-IN')} {t('queueDevoteesLabel')}
          </div>
        </div>
        <div className="dp-stat-card">
          <div className="dp-stat-label">
            {t('nextFestivalLabel')} · {t('festivalName')}
          </div>
          <div className="dp-countdown">
            <div>
              <div className="n">{String(countdown.days).padStart(2, '0')}</div>
              <div className="l">{t('countdownDays')}</div>
            </div>
            <div>
              <div className="n">{String(countdown.hours).padStart(2, '0')}</div>
              <div className="l">{t('countdownHours')}</div>
            </div>
            <div>
              <div className="n">{String(countdown.minutes).padStart(2, '0')}</div>
              <div className="l">{t('countdownMinutes')}</div>
            </div>
            <div>
              <div className="n">{String(countdown.seconds).padStart(2, '0')}</div>
              <div className="l">{t('countdownSeconds')}</div>
            </div>
          </div>
        </div>
        <div className="dp-stat-card">
          <div className="dp-stat-label">{t('todayScheduleTitle')}</div>
          {schedule.map((item) => (
            <div key={item.labelKey} className="dp-sched-item">
              <span>{t(item.labelKey)}</span>
              <span>{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
