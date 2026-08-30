import { useGetFacilitiesQuery } from '@/services/api/endpoints/facilityApi'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { ScreenRenderer } from '@/components/screenBuilder/ScreenRenderer'

export function DevoteeFacilitiesPage() {
  const { t } = useDevoteeTranslation()
  const { data: facilities = [], isLoading } = useGetFacilitiesQuery()

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('devotee.facilitiesTitle')}</h1>
        <p>{t('devotee.facilitiesSubtitle')}</p>
      </div>

      <ScreenRenderer screenKey="facilities" />

      {isLoading ? (
        <p style={{ marginTop: 20 }}>{t('devotee.loading')}</p>
      ) : (
        <div className="dp-grid dp-grid-4" style={{ marginTop: 20 }}>
          {facilities.map((facility) => (
            <div className="dp-facility-card" key={facility._id}>
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
      )}
    </div>
  )
}
