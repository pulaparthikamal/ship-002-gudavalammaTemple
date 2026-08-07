import { useMemo, useState } from 'react'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import { useToast } from '@/hooks/useToast'

interface Quota {
  id: 'sarva' | 'special' | 'senior'
  nameKey: 'quotaSarvaName' | 'quotaSpecialName' | 'quotaSeniorName'
  descKey: 'quotaSarvaDesc' | 'quotaSpecialDesc' | 'quotaSeniorDesc'
  price: number
}

const QUOTAS: Quota[] = [
  { id: 'sarva', nameKey: 'quotaSarvaName', descKey: 'quotaSarvaDesc', price: 0 },
  { id: 'special', nameKey: 'quotaSpecialName', descKey: 'quotaSpecialDesc', price: 300 },
  { id: 'senior', nameKey: 'quotaSeniorName', descKey: 'quotaSeniorDesc', price: 0 },
]

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { firstDay, daysInMonth }
}

const LOCALE_MAP = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' } as const

export function DevoteeDarshanPage() {
  const { t, language } = useDevoteeLanguage()
  const { showToast } = useToast()
  const now = useMemo(() => new Date(), [])
  const { firstDay, daysInMonth } = buildCalendarDays(now.getFullYear(), now.getMonth())

  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedQuota, setSelectedQuota] = useState<Quota>(QUOTAS[0])
  const [devoteeCount, setDevoteeCount] = useState(2)

  const monthLabel = now.toLocaleDateString(LOCALE_MAP[language], { month: 'long', year: 'numeric' })
  const selectedDateLabel =
    selectedDay !== null ? `${selectedDay} ${now.toLocaleDateString(LOCALE_MAP[language], { month: 'short' })}` : t('noDateSelected')
  const total = selectedQuota.price * devoteeCount

  const dayOfWeekLabels = useMemo(() => {
    const base = new Date(2024, 0, 7) // a Sunday
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(base)
      d.setDate(base.getDate() + index)
      return d.toLocaleDateString(LOCALE_MAP[language], { weekday: 'short' }).slice(0, 1)
    })
  }, [language])

  const handleConfirm = () => {
    if (selectedDay === null) {
      showToast({ severity: 'warn', summary: t('darshanTitle'), detail: t('selectDateFirst') })
      return
    }

    showToast({
      severity: 'success',
      summary: t('darshanTitle'),
      detail: `${selectedDateLabel} · ${t(selectedQuota.nameKey)} · ${devoteeCount}`,
    })
  }

  const cells: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('darshanTitle')}</h1>
        <p>{t('darshanSubtitle')}</p>
      </div>

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
                  onClick={() => !isPast && setSelectedDay(day)}
                >
                  {day}
                </div>
              )
            })}
          </div>
        </div>

        <div className="dp-panel">
          {QUOTAS.map((quota) => (
            <div
              key={quota.id}
              className={`dp-quota-card ${selectedQuota.id === quota.id ? 'active' : ''}`}
              onClick={() => setSelectedQuota(quota)}
            >
              <div>
                <div className="qname">{t(quota.nameKey)}</div>
                <div className="qdesc">{t(quota.descKey)}</div>
              </div>
              <div className="qprice">{quota.price === 0 ? t('free') : `₹${quota.price}`}</div>
            </div>
          ))}

          <div className="dp-stepper">
            <span style={{ fontSize: 13 }}>{t('devoteesLabel')}</span>
            <button type="button" onClick={() => setDevoteeCount((count) => Math.max(1, count - 1))}>
              –
            </button>
            <span style={{ fontFamily: 'var(--dp-font-body)', fontWeight: 700 }}>{devoteeCount}</span>
            <button type="button" onClick={() => setDevoteeCount((count) => Math.min(5, count + 1))}>
              +
            </button>
            <span style={{ fontSize: '11.5px', color: 'var(--dp-ink-soft)' }}>{t('maxNote')}</span>
          </div>

          <div className="dp-summary-row">
            <span>{t('selectedDateLabel')}</span>
            <span>{selectedDateLabel}</span>
          </div>
          <div className="dp-summary-row">
            <span>{t('quotaLabel')}</span>
            <span>{t(selectedQuota.nameKey)}</span>
          </div>
          <div className="dp-summary-row total">
            <span>{t('totalLabel')}</span>
            <span>₹{total.toLocaleString('en-IN')}</span>
          </div>

          <button type="button" className="dp-btn-primary-pill" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={handleConfirm}>
            {t('proceedButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
