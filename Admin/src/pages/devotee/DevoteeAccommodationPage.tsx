import { accommodationCatalog } from '@/features/devotee/i18n/devoteeContent'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import { useToast } from '@/hooks/useToast'

export function DevoteeAccommodationPage() {
  const { t, language } = useDevoteeLanguage()
  const { showToast } = useToast()
  const stays = accommodationCatalog[language]

  const handleBook = (name: string) => {
    showToast({ severity: 'success', summary: t('accommodationTitle'), detail: name })
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('accommodationTitle')}</h1>
        <p>{t('accommodationSubtitle')}</p>
      </div>

      <div className="dp-grid dp-grid-4" style={{ marginTop: 20 }}>
        {stays.map((stay) => (
          <div className="dp-offer-card" key={stay.id}>
            <div className="dp-offer-media">
              <svg viewBox="0 0 24 24">
                <path d="M3 21V9l9-6 9 6v12M9 21v-6h6v6" />
              </svg>
            </div>
            <div className="dp-offer-body">
              <h3>{stay.name}</h3>
              <div className="meta">{stay.detail}</div>
              <div className="price">
                {stay.pricePerNight === 0 ? t('free') : `₹${stay.pricePerNight.toLocaleString('en-IN')}${t('perNight')}`}
              </div>
            </div>
            <div className="dp-offer-foot">
              <span style={{ fontSize: 11, color: 'var(--dp-ink-soft)' }}>{t('availabilityNote')}</span>
              <button type="button" className="dp-small-btn filled" onClick={() => handleBook(stay.name)}>
                {t('bookStay')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
