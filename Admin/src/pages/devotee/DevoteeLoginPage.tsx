import { Link } from 'react-router-dom'
import { DevoteeArtwork } from '@/features/devotee/components/DevoteeArtwork'
import { DevoteeLoginForm } from '@/features/devotee/components/DevoteeLoginForm'
import { DEVOTEE_LANGUAGES } from '@/features/devotee/i18n/devoteeTranslations'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import '@/features/devotee/styles/devoteePortal.css'

export function DevoteeLoginPage() {
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
          <div className="dp-auth-brand-row">
            <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
              <path d="M20 2 L26 14 L14 14 Z" fill="#7c1220" />
              <rect x="16" y="14" width="8" height="18" fill="#a9790c" />
              <circle cx="20" cy="34" r="3" fill="#c1421a" />
            </svg>
            <div>
              <div style={{ fontFamily: 'var(--dp-font-brand)', fontSize: 21, color: 'var(--dp-maroon)', lineHeight: 1 }}>
                {t('appName')}
              </div>
              <div
                style={{
                  fontFamily: 'var(--dp-font-body)',
                  fontSize: 9,
                  letterSpacing: 3,
                  color: 'var(--dp-gold)',
                  fontWeight: 600,
                  marginTop: 3,
                }}
              >
                {t('loginBrandSubtitle')}
              </div>
            </div>
          </div>

          <p className="dp-auth-eyebrow">{t('eyebrow')}</p>
          <h1 className="dp-auth-title">
            {t('loginHeroLine1')}
            <br />
            <span>{t('loginHeroHighlight')}</span>
          </h1>
          <p className="dp-auth-tagline">{t('loginHeroTagline')}</p>
          <div className="dp-auth-chips">
            <div className="dp-card" style={{ padding: '9px 14px', borderRadius: 24, fontSize: '12.5px' }}>
              {t('loginChipSecure')}
            </div>
            <div className="dp-card" style={{ padding: '9px 14px', borderRadius: 24, fontSize: '12.5px' }}>
              {t('loginChipSupport')}
            </div>
          </div>

          <div className="dp-auth-card" style={{ marginTop: 26, maxWidth: 440 }}>
            <span className="dp-auth-corner tl" />
            <span className="dp-auth-corner tr" />
            <span className="dp-auth-corner bl" />
            <span className="dp-auth-corner br" />

            <h2 className="dp-auth-card-title">{t('loginTabTitle')}</h2>

            <DevoteeLoginForm />

            <p className="dp-auth-footer-link">
              {t('loginNoAccount')}{' '}
              <Link to="/devotee/register">{t('loginCreateAccount')}</Link>
            </p>
            <p className="dp-auth-card-note">{t('loginTermsNote')}</p>
          </div>

          <p className="dp-auth-footer-link" style={{ marginTop: 14 }}>
            <Link to="/login">{t('loginStaffCross')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
