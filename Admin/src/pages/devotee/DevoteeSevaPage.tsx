import type { SevaCategory } from '@/features/devotee/i18n/devoteeContent'
import { sevaCatalog } from '@/features/devotee/i18n/devoteeContent'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import { useToast } from '@/hooks/useToast'

const CATEGORIES: { id: SevaCategory; nameKey: 'categoryParoksha' | 'categoryPratyaksha' | 'categorySaswata'; descKey: 'categoryParokshaDesc' | 'categoryPratyakshaDesc' | 'categorySaswataDesc' }[] = [
  { id: 'pratyaksha', nameKey: 'categoryPratyaksha', descKey: 'categoryPratyakshaDesc' },
  { id: 'paroksha', nameKey: 'categoryParoksha', descKey: 'categoryParokshaDesc' },
  { id: 'saswata', nameKey: 'categorySaswata', descKey: 'categorySaswataDesc' },
]

export function DevoteeSevaPage() {
  const { t, language } = useDevoteeLanguage()
  const { showToast } = useToast()
  const sevas = sevaCatalog[language]

  const handleBook = (name: string) => {
    showToast({ severity: 'success', summary: t('sevaTitle'), detail: name })
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('sevaTitle')}</h1>
        <p>{t('sevaSubtitle')}</p>
      </div>

      {CATEGORIES.map((category) => (
        <section key={category.id}>
          <div className="dp-sec-title">
            {t(category.nameKey)}
            <span className={`dp-badge ${category.id}`}>{category.id}</span>
          </div>
          <p style={{ color: 'var(--dp-ink-soft)', fontSize: 13, marginTop: -8, marginBottom: 14 }}>{t(category.descKey)}</p>
          <div className="dp-grid dp-grid-4">
            {sevas
              .filter((seva) => seva.category === category.id)
              .map((seva) => (
                <div className="dp-offer-card" key={seva.id}>
                  <div className="dp-offer-media">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 22c0-4 4-6 8-6s8 2 8 6" />
                    </svg>
                  </div>
                  <div className="dp-offer-body">
                    <h3>{seva.name}</h3>
                    <div className="meta">{seva.timing}</div>
                    <div className="price">
                      ₹{seva.price.toLocaleString('en-IN')}
                      {category.id === 'saswata' ? ` (${t('oneTime')})` : ''}
                    </div>
                  </div>
                  <div className="dp-offer-foot">
                    <span style={{ fontSize: 11, color: 'var(--dp-ink-soft)' }}>{t('limitedSlots')}</span>
                    <button type="button" className="dp-small-btn filled" onClick={() => handleBook(seva.name)}>
                      {t('bookSeva')}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
