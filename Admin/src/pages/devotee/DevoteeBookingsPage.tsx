import { useMemo, useState } from 'react'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'

type BookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled'
type BookingFilter = 'all' | 'upcoming' | 'past'

interface Booking {
  id: string
  type: string
  details: string
  offsetDays: number
  status: BookingStatus
}

const MOCK_BOOKINGS: Booking[] = [
  { id: 'BK-1042', type: 'Darshan', details: 'Special Entry Darshan · 2 devotees', offsetDays: 6, status: 'confirmed' },
  { id: 'BK-1038', type: 'Seva', details: 'Kalyanotsavam', offsetDays: 14, status: 'pending' },
  { id: 'BK-1021', type: 'Accommodation', details: 'AC Cottage · 2 nights', offsetDays: -9, status: 'completed' },
  { id: 'BK-1017', type: 'Prasadam', details: 'Laddu (Box of 5) x 2', offsetDays: -3, status: 'completed' },
  { id: 'BK-1005', type: 'Seva', details: 'Abhishekam (Paroksha)', offsetDays: -20, status: 'cancelled' },
]

export function DevoteeBookingsPage() {
  const { t } = useDevoteeLanguage()
  const [filter, setFilter] = useState<BookingFilter>('all')
  const today = useMemo(() => new Date(), [])

  const rows = MOCK_BOOKINGS.filter((booking) => {
    if (filter === 'upcoming') return booking.offsetDays >= 0
    if (filter === 'past') return booking.offsetDays < 0
    return true
  })

  const statusLabel: Record<BookingStatus, string> = {
    confirmed: t('statusConfirmed'),
    pending: t('statusPending'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  }

  const formatDate = (offsetDays: number) => {
    const date = new Date(today)
    date.setDate(date.getDate() + offsetDays)
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('bookingsTitle')}</h1>
        <p>{t('bookingsSubtitle')}</p>
      </div>

      <div className="dp-filter-row" style={{ marginTop: 20 }}>
        <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          {t('filterAll')}
        </button>
        <button type="button" className={filter === 'upcoming' ? 'active' : ''} onClick={() => setFilter('upcoming')}>
          {t('filterUpcoming')}
        </button>
        <button type="button" className={filter === 'past' ? 'active' : ''} onClick={() => setFilter('past')}>
          {t('filterPast')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="dp-empty-state">
          <div style={{ fontSize: 40 }}>🙏</div>
          <h3>{t('bookingsEmptyTitle')}</h3>
          <p>{t('bookingsEmptyDesc')}</p>
        </div>
      ) : (
        <div className="dp-table-wrap">
          <table className="dp-table">
            <thead>
              <tr>
                <th>{t('columnType')}</th>
                <th>{t('columnDetails')}</th>
                <th>{t('columnDate')}</th>
                <th>{t('columnStatus')}</th>
                <th>{t('columnAction')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.type}</td>
                  <td>{booking.details}</td>
                  <td>{formatDate(booking.offsetDays)}</td>
                  <td>
                    <span className={`dp-status-pill ${booking.status}`}>{statusLabel[booking.status]}</span>
                  </td>
                  <td>
                    {booking.status === 'confirmed' || booking.status === 'pending' ? (
                      <button type="button" className="dp-small-btn">
                        {t('cancelButton')}
                      </button>
                    ) : (
                      <button type="button" className="dp-small-btn">
                        {t('downloadButton')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
