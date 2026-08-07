import { DevoteeArtwork } from '@/features/devotee/components/DevoteeArtwork'
import { DevoteeForgotPasswordForm } from '@/features/devotee/components/DevoteeForgotPasswordForm'
import { DEVOTEE_LANGUAGES } from '@/features/devotee/i18n/devoteeTranslations'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import '@/features/devotee/styles/devoteePortal.css'

export function DevoteeForgotPasswordPage() {
  const { t, language, setLanguage } = useDevoteeLanguage()

  return (
    <div className="devotee-portal">
      <div className="dp-lang-strip">
        <span className="dp-lang-icon" aria-hidden="true">
          🕉️
        </span>
        {DEVOTEE_LANGUAGES.map((option, index) => (
          <span key={option.code} style={{ display: 'flex', alignItems: 'center' }}>
            {index > 0 ? <span className="dp-sep">|</span> : null}
            <button
              type="button"
              className={language === option.code ? 'active' : ''}
              onClick={() => setLanguage(option.code)}
            >
              {option.label}
            </button>
          </span>
        ))}
      </div>

      <div className="dp-auth-hero">
        <DevoteeArtwork />

        <div>
          <p className="dp-auth-eyebrow">{t('eyebrow')}</p>
          <h1 className="dp-auth-title">{t('forgotTitle')}</h1>
          <p className="dp-auth-tagline">{t('forgotSubtitle')}</p>

          <div className="dp-auth-card" style={{ maxWidth: 440 }}>
            <span className="dp-auth-corner tl" />
            <span className="dp-auth-corner tr" />
            <span className="dp-auth-corner bl" />
            <span className="dp-auth-corner br" />

            <DevoteeForgotPasswordForm />
          </div>
        </div>
      </div>
    </div>
  )
}
