import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useGetNearbyPlacesQuery } from '@/services/api/endpoints/nearbyPlacesApi'
import { ScreenRenderer } from '@/components/screenBuilder/ScreenRenderer'

export function DevoteeNearbyPlacesPage() {
  const { t } = useDevoteeTranslation()
  const { data: places = [], isLoading } = useGetNearbyPlacesQuery()

  const sorted = [...places].sort((a, b) => a.distanceKm - b.distanceKm)

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('devotee.nearbyPlacesTitle')}</h1>
        <p>{t('devotee.nearbyPlacesSubtitle')}</p>
      </div>

      <ScreenRenderer screenKey="nearbyPlaces" />

      {isLoading && <p style={{ marginTop: 20 }}>{t('devotee.loading')}</p>}

      <div className="dp-grid dp-grid-3" style={{ marginTop: 20 }}>
        {sorted.map((place) => (
          <div className="dp-offer-card" key={place._id}>
            {place.imageUrl && (
              <div className="dp-offer-media">
                <img src={place.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div className="dp-offer-body">
              <h3>{place.name}</h3>
              <div className="meta">{place.distanceKm} km · {place.category}</div>
              <p style={{ fontSize: 13, color: 'var(--dp-ink-soft)' }}>{place.description}</p>
            </div>
            <div className="dp-offer-foot">
              {place.mapLink ? (
                <a className="dp-small-btn filled" href={place.mapLink} target="_blank" rel="noopener noreferrer">
                  {t('devotee.getDirections')}
                </a>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--dp-ink-soft)' }}>{place.category}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
