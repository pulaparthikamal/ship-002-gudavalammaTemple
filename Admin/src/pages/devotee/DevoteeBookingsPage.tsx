import { useMemo, useState } from 'react'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import { YearFilter } from '@/components/ui/YearFilter'
import {
  useCancelBookingMutation,
  useGetBookingsQuery,
  useLazyGetBookingReceiptQuery,
  type BookingFilter,
  type BookingStatus,
} from '@/services/api/endpoints/bookingApi'

export function DevoteeBookingsPage() {
  const { t } = useDevoteeTranslation()
  const { showToast } = useToast()
  const [filter, setFilter] = useState<BookingFilter>('all')
  const [year, setYear] = useState<number | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const { data: allRows = [], isLoading, refetch } = useGetBookingsQuery({ filter })
  const rows = useMemo(
    () => (year ? allRows.filter((booking) => new Date(booking.date).getFullYear() === year) : allRows),
    [allRows, year],
  )
  const [cancelBooking] = useCancelBookingMutation()
  const [fetchReceipt] = useLazyGetBookingReceiptQuery()

  const statusLabel: Record<BookingStatus, string> = useMemo(
    () => ({
      confirmed: t('devotee.statusConfirmed'),
      pending: t('devotee.statusPending'),
      completed: t('devotee.statusCompleted'),
      cancelled: t('devotee.statusCancelled'),
    }),
    [t],
  )

  const formatDate = (isoDate: string) =>
    new Date(isoDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const handleCancel = async (id: string) => {
    setCancellingId(id)
    try {
      await cancelBooking(id).unwrap()
      showToast({ severity: 'success', summary: t('devotee.cancelButton'), detail: t('devotee.bookingsTitle') })
      refetch()
    } catch {
      showToast({ severity: 'error', summary: t('devotee.cancelButton'), detail: t('devotee.requestFailed') })
    } finally {
      setCancellingId(null)
    }
  }

  const handleDownload = async (id: string) => {
    try {
      const receipt = await fetchReceipt(id).unwrap()
      const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `receipt-${receipt.bookingId}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      showToast({ severity: 'error', summary: t('devotee.downloadButton'), detail: t('devotee.requestFailed') })
    }
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('devotee.bookingsTitle')}</h1>
        <p>{t('devotee.bookingsSubtitle')}</p>
      </div>

      <div className="dp-filter-row" style={{ marginTop: 20 }}>
        <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          {t('devotee.filterAll')}
        </button>
        <button type="button" className={filter === 'upcoming' ? 'active' : ''} onClick={() => setFilter('upcoming')}>
          {t('devotee.filterUpcoming')}
        </button>
        <button type="button" className={filter === 'past' ? 'active' : ''} onClick={() => setFilter('past')}>
          {t('devotee.filterPast')}
        </button>
        <YearFilter value={year} onChange={setYear} allLabel={t('devotee.filterAllYears')} className="w-32" />
      </div>

      {isLoading ? (
        <p style={{ marginTop: 20 }}>{t('devotee.loading')}</p>
      ) : rows.length === 0 ? (
        <div className="dp-empty-state">
          <div style={{ fontSize: 40 }}>🙏</div>
          <h3>{t('devotee.bookingsEmptyTitle')}</h3>
          <p>{t('devotee.bookingsEmptyDesc')}</p>
        </div>
      ) : (
        <div className="dp-table-wrap">
          <table className="dp-table">
            <thead>
              <tr>
                <th>{t('devotee.columnType')}</th>
                <th>{t('devotee.columnDetails')}</th>
                <th>{t('devotee.columnDate')}</th>
                <th>{t('devotee.columnStatus')}</th>
                <th>{t('devotee.columnAction')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((booking) => (
                <tr key={booking._id}>
                  <td style={{ textTransform: 'capitalize' }}>{booking.type}</td>
                  <td>
                    {booking.title}
                    {booking.amount > 0 ? ` · ₹${booking.amount.toLocaleString('en-IN')}` : ''}
                  </td>
                  <td>{formatDate(booking.date)}</td>
                  <td>
                    <span className={`dp-status-pill ${booking.status}`}>{statusLabel[booking.status]}</span>
                  </td>
                  <td>
                    {booking.status === 'confirmed' || booking.status === 'pending' ? (
                      <button
                        type="button"
                        className="dp-small-btn"
                        onClick={() => handleCancel(booking._id)}
                        disabled={cancellingId === booking._id}
                      >
                        {t('devotee.cancelButton')}
                      </button>
                    ) : (
                      <button type="button" className="dp-small-btn" onClick={() => handleDownload(booking._id)}>
                        {t('devotee.downloadButton')}
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
