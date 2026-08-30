import { Link } from 'react-router-dom'
import { useDevoteeTranslation } from '@/i18n/useTranslation'

interface GuestContactFieldsProps {
  guestName: string
  onGuestNameChange: (value: string) => void
  guestEmail: string
  onGuestEmailChange: (value: string) => void
  guestPhone: string
  onGuestPhoneChange: (value: string) => void
}

export function GuestContactFields({
  guestName,
  onGuestNameChange,
  guestEmail,
  onGuestEmailChange,
  guestPhone,
  onGuestPhoneChange,
}: GuestContactFieldsProps) {
  const { t } = useDevoteeTranslation()

  return (
    <div className="dp-panel" style={{ marginTop: 16 }}>
      <div className="dp-sec-title" style={{ marginTop: 0 }}>
        {t('devotee.guestCheckoutTitle')}
      </div>
      <p style={{ fontSize: 13, color: 'var(--dp-ink-soft)', marginBottom: 12 }}>
        {t('devotee.guestCheckoutNote')}
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        <input
          className="dp-input"
          placeholder={t('devotee.guestNameLabel')}
          value={guestName}
          onChange={(e) => onGuestNameChange(e.target.value)}
        />
        <input
          className="dp-input"
          type="email"
          placeholder={t('devotee.guestEmailLabel')}
          value={guestEmail}
          onChange={(e) => onGuestEmailChange(e.target.value)}
        />
        <input
          className="dp-input"
          type="tel"
          placeholder={t('devotee.guestPhoneLabel')}
          value={guestPhone}
          onChange={(e) => onGuestPhoneChange(e.target.value)}
        />
      </div>
      <p style={{ fontSize: 12.5, marginTop: 10 }}>
        {t('devotee.guestLoginNudge')}{' '}
        <Link to="/devotee/login">{t('devotee.homeDevoteeLoginCta')}</Link>
      </p>
    </div>
  )
}
