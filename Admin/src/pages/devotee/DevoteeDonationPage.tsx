import { useState } from 'react'
import { InputText } from 'primereact/inputtext'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import { useToast } from '@/hooks/useToast'

const PRESET_AMOUNTS = [101, 501, 1001, 2501, 5001]

interface Fund {
  id: string
  nameKey: 'hundiTitle' | 'annadanamTitle' | 'goSamrakshanaTitle'
  descKey: 'hundiDesc' | 'annadanamDesc' | 'goSamrakshanaDesc'
  icon: string
}

const FUNDS: Fund[] = [
  { id: 'hundi', nameKey: 'hundiTitle', descKey: 'hundiDesc', icon: 'M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5 9 5 11 7 12 8c1-1 3-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.65 12 21 12 21z' },
  { id: 'annadanam', nameKey: 'annadanamTitle', descKey: 'annadanamDesc', icon: 'M4 12a8 8 0 0016 0M4 12a8 8 0 018-8M4 12H2m18 0h2' },
  { id: 'goSamrakshana', nameKey: 'goSamrakshanaTitle', descKey: 'goSamrakshanaDesc', icon: 'M4 10l8-6 8 6v10H4z' },
]

export function DevoteeDonationPage() {
  const { t } = useDevoteeLanguage()
  const { showToast } = useToast()
  const [activeFund, setActiveFund] = useState<Fund>(FUNDS[0])
  const [amount, setAmount] = useState<number | null>(501)
  const [customAmount, setCustomAmount] = useState('')

  const effectiveAmount = customAmount ? Number(customAmount) || 0 : amount ?? 0

  const handleDonate = () => {
    if (!effectiveAmount) {
      return
    }
    showToast({
      severity: 'success',
      summary: t('donateNow'),
      detail: `₹${effectiveAmount.toLocaleString('en-IN')} — ${t(activeFund.nameKey)}`,
    })
    setCustomAmount('')
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('donationTitle')}</h1>
        <p>{t('donationSubtitle')}</p>
      </div>

      <div className="dp-grid dp-grid-3" style={{ marginTop: 20 }}>
        {FUNDS.map((fund) => (
          <div
            key={fund.id}
            className="dp-tilt-card"
            style={{ cursor: 'pointer', borderColor: activeFund.id === fund.id ? 'var(--dp-gold)' : undefined }}
            onClick={() => setActiveFund(fund)}
          >
            <div className="dp-icon-wrap">
              <svg viewBox="0 0 24 24">
                <path d={fund.icon} />
              </svg>
            </div>
            <h3>{t(fund.nameKey)}</h3>
            <p>{t(fund.descKey)}</p>
          </div>
        ))}
      </div>

      <div className="dp-panel" style={{ maxWidth: 460, marginTop: 24 }}>
        <div className="dp-stat-label" style={{ marginBottom: 4 }}>
          {t(activeFund.nameKey)}
        </div>
        <p style={{ fontSize: 13, color: 'var(--dp-ink-soft)', marginTop: 0 }}>{t('chooseAmount')}</p>
        <div className="dp-amount-row">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`dp-amount-chip ${!customAmount && amount === preset ? 'active' : ''}`}
              onClick={() => {
                setAmount(preset)
                setCustomAmount('')
              }}
            >
              ₹{preset.toLocaleString('en-IN')}
            </button>
          ))}
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>{t('customAmount')}</label>
          <InputText
            value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value.replace(/\D/g, ''))}
            placeholder={t('customAmountPlaceholder')}
          />
        </div>
        <button type="button" className="dp-btn-primary-pill" style={{ width: '100%', justifyContent: 'center' }} onClick={handleDonate}>
          {t('donateNow')} · ₹{effectiveAmount.toLocaleString('en-IN')}
        </button>
        <p className="dp-auth-card-note">{t('taxNote')}</p>
      </div>
    </div>
  )
}
