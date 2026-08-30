import { useEffect, useState } from 'react'
import { InputText } from 'primereact/inputtext'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import { useCreateDonationMutation, useGetDonationFundsQuery, type DonationFund } from '@/services/api/endpoints/donationApi'
import { useGuestCheckout } from '@/features/devotee/hooks/useGuestCheckout'
import { GuestContactFields } from '@/features/devotee/components/GuestContactFields'
import { ScreenRenderer } from '@/components/screenBuilder/ScreenRenderer'
import { UpiPaymentPanel } from '@/features/devotee/components/UpiPaymentPanel'
import { trackFunnelStep } from '@/utils/analytics'

const PRESET_AMOUNTS = [101, 501, 1001, 2501, 5001]

const FUND_ICONS: Record<string, string> = {
  hundi: 'M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5 9 5 11 7 12 8c1-1 3-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.65 12 21 12 21z',
  annadanam: 'M4 12a8 8 0 0016 0M4 12a8 8 0 018-8M4 12H2m18 0h2',
  goSamrakshana: 'M4 10l8-6 8 6v10H4z',
}

export function DevoteeDonationPage() {
  const { t } = useDevoteeTranslation()
  const { showToast } = useToast()
  const { data: funds = [], isLoading } = useGetDonationFundsQuery()
  const [createDonation, { isLoading: isDonating }] = useCreateDonationMutation()
  const guestCheckout = useGuestCheckout()

  const [activeFund, setActiveFund] = useState<DonationFund | null>(null)
  const [amount, setAmount] = useState<number | null>(501)
  const [customAmount, setCustomAmount] = useState('')
  const [paidDonation, setPaidDonation] = useState<{ refId: string; amount: number; reference: string } | null>(null)

  useEffect(() => {
    trackFunnelStep('/devotee/donations', 'donation', 0, 'viewed')
  }, [])

  useEffect(() => {
    if (!activeFund && funds.length > 0) {
      setActiveFund(funds[0])
    }
  }, [activeFund, funds])

  const effectiveAmount = customAmount ? Number(customAmount) || 0 : amount ?? 0

  const handleDonate = async () => {
    if (!effectiveAmount || !activeFund) {
      return
    }
    if (!guestCheckout.isGuestInfoValid) {
      showToast({ severity: 'warn', summary: t('devotee.donateNow'), detail: t('devotee.guestCheckoutNote') })
      return
    }
    try {
      const created = await createDonation({
        fundId: activeFund._id,
        amount: effectiveAmount,
        ...guestCheckout.guestPayload,
      }).unwrap()
      trackFunnelStep('/devotee/donations', 'donation', 2, 'submitted')
      showToast({
        severity: 'success',
        summary: t('devotee.donateNow'),
        detail: `₹${effectiveAmount.toLocaleString('en-IN')} — ${activeFund.name}`,
      })
      setPaidDonation({ refId: created._id, amount: created.amount, reference: activeFund.name })
      setCustomAmount('')
    } catch {
      showToast({ severity: 'error', summary: t('devotee.donateNow'), detail: t('devotee.requestFailed') })
    }
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('devotee.donationTitle')}</h1>
        <p>{t('devotee.donationSubtitle')}</p>
      </div>

      <ScreenRenderer screenKey="donations" />

      {paidDonation && (
        <UpiPaymentPanel refId={paidDonation.refId} amount={paidDonation.amount} reference={paidDonation.reference} />
      )}

      {isLoading ? (
        <p style={{ marginTop: 20 }}>{t('devotee.loading')}</p>
      ) : (
        <>
          <div className="dp-grid dp-grid-3" style={{ marginTop: 20 }}>
            {funds.map((fund) => (
              <div
                key={fund._id}
                className="dp-tilt-card"
                style={{ cursor: 'pointer', borderColor: activeFund?._id === fund._id ? 'var(--dp-gold)' : undefined }}
                onClick={() => {
                  setActiveFund(fund)
                  trackFunnelStep('/devotee/donations', 'donation', 1, 'fund_selected')
                }}
              >
                <div className="dp-icon-wrap">
                  <svg viewBox="0 0 24 24">
                    <path d={FUND_ICONS[fund.slug] ?? FUND_ICONS.hundi} />
                  </svg>
                </div>
                <h3>{fund.name}</h3>
                <p>{fund.description}</p>
              </div>
            ))}
          </div>

          {activeFund && (
            <div className="dp-panel" style={{ maxWidth: 460, marginTop: 24 }}>
              <div className="dp-stat-label" style={{ marginBottom: 4 }}>
                {activeFund.name}
              </div>
              <p style={{ fontSize: 13, color: 'var(--dp-ink-soft)', marginTop: 0 }}>{t('devotee.chooseAmount')}</p>
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
                <label style={{ display: 'block', marginBottom: 6 }}>{t('devotee.customAmount')}</label>
                <InputText
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value.replace(/\D/g, ''))}
                  placeholder={t('devotee.customAmountPlaceholder')}
                />
              </div>
              {!guestCheckout.isAuthenticated && (
                <GuestContactFields
                  guestName={guestCheckout.guestName}
                  onGuestNameChange={guestCheckout.setGuestName}
                  guestEmail={guestCheckout.guestEmail}
                  onGuestEmailChange={guestCheckout.setGuestEmail}
                  guestPhone={guestCheckout.guestPhone}
                  onGuestPhoneChange={guestCheckout.setGuestPhone}
                />
              )}

              <button
                type="button"
                className="dp-btn-primary-pill"
                style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
                onClick={handleDonate}
                disabled={isDonating || !effectiveAmount}
              >
                {t('devotee.donateNow')} · ₹{effectiveAmount.toLocaleString('en-IN')}
              </button>
              <p className="dp-auth-card-note">{t('devotee.taxNote')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
