import { facilityCatalog } from '@/features/devotee/i18n/devoteeContent'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'

export function DevoteeFacilitiesPage() {
  const { t, language } = useDevoteeLanguage()
  const facilities = facilityCatalog[language]

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('facilitiesTitle')}</h1>
        <p>{t('facilitiesSubtitle')}</p>
      </div>

      <div className="dp-grid dp-grid-4" style={{ marginTop: 20 }}>
        {facilities.map((facility) => (
          <div className="dp-facility-card" key={facility.id}>
            <div className="dp-icon-wrap">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h4>{facility.name}</h4>
            <p>{facility.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
