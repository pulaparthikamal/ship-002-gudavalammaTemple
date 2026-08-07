import { useMemo, useState } from 'react'
import { prasadamCatalog } from '@/features/devotee/i18n/devoteeContent'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import { useToast } from '@/hooks/useToast'

export function DevoteePrasadamPage() {
  const { t, language } = useDevoteeLanguage()
  const { showToast } = useToast()
  const items = prasadamCatalog[language]
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const changeQty = (id: string, delta: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))
  }

  const { totalItems, totalAmount } = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const qty = quantities[item.id] ?? 0
        return { totalItems: acc.totalItems + qty, totalAmount: acc.totalAmount + qty * item.price }
      },
      { totalItems: 0, totalAmount: 0 },
    )
  }, [items, quantities])

  const handleCheckout = () => {
    if (totalItems === 0) {
      showToast({ severity: 'warn', summary: t('prasadamTitle'), detail: t('emptyCart') })
      return
    }
    showToast({ severity: 'success', summary: t('prasadamTitle'), detail: `${t('cartTotal')}: ₹${totalAmount.toLocaleString('en-IN')}` })
    setQuantities({})
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('prasadamTitle')}</h1>
        <p>{t('prasadamSubtitle')}</p>
      </div>

      <div className="dp-grid dp-grid-4" style={{ marginTop: 20, marginBottom: 20 }}>
        {items.map((item) => (
          <div className="dp-offer-card" key={item.id}>
            <div className="dp-offer-media">
              <svg viewBox="0 0 24 24">
                <path d="M4 12a8 8 0 0016 0M4 12a8 8 0 018-8M4 12H2m18 0h2" />
              </svg>
            </div>
            <div className="dp-offer-body">
              <h3>{item.name}</h3>
              <div className="price">₹{item.price}</div>
            </div>
            <div className="dp-offer-foot">
              <div className="dp-qty-box">
                <button type="button" onClick={() => changeQty(item.id, -1)}>
                  –
                </button>
                <span>{quantities[item.id] ?? 0}</span>
                <button type="button" onClick={() => changeQty(item.id, 1)}>
                  +
                </button>
              </div>
              <span style={{ fontSize: 11, color: 'var(--dp-ink-soft)' }}>{t('perUnit')}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dp-panel" style={{ maxWidth: 340, marginLeft: 'auto' }}>
        <div className="dp-summary-row">
          <span>{t('cartItems')}</span>
          <span>{totalItems}</span>
        </div>
        <div className="dp-summary-row total">
          <span>{t('cartTotal')}</span>
          <span>₹{totalAmount.toLocaleString('en-IN')}</span>
        </div>
        <button type="button" className="dp-btn-primary-pill" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={handleCheckout}>
          {t('checkoutButton')}
        </button>
      </div>
    </div>
  )
}
