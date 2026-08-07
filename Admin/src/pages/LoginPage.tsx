import { Link } from 'react-router-dom'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { TempleArtwork } from '@/features/auth/components/TempleArtwork'
import { LOGIN_LANGUAGES } from '@/features/auth/i18n/loginTranslations'
import { LoginLanguageProvider } from '@/features/auth/i18n/LoginLanguageContext'
import { useLoginLanguage } from '@/features/auth/i18n/useLoginLanguage'
import '@/features/auth/styles/templeLogin.css'

function LanguageStrip() {
  const { language, setLanguage } = useLoginLanguage()

  return (
    <div className="temple-login-lang-strip">
      <span className="temple-login-lang-icon" aria-hidden="true">
        🕉️
      </span>
      {LOGIN_LANGUAGES.map((option, index) => (
        <span key={option.code} style={{ display: 'flex', alignItems: 'center' }}>
          {index > 0 ? <span className="temple-login-sep">|</span> : null}
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
  )
}

function LoginPageContent() {
  const { t } = useLoginLanguage()

  return (
    <>
      <LanguageStrip />
      <div className="temple-login-hero">
        <TempleArtwork />

        <div className="temple-login-right-col">
          <div className="temple-login-brand-block">
            <div className="temple-login-brand-row">
              <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
                <path d="M20 2 L26 14 L14 14 Z" fill="#7c1220" />
                <rect x="16" y="14" width="8" height="18" fill="#a9790c" />
                <circle cx="20" cy="34" r="3" fill="#c1421a" />
              </svg>
              <div>
                <div className="temple-login-brand-name">{t('brandName')}</div>
                <div className="temple-login-brand-subtitle">{t('brandSubtitle')}</div>
              </div>
            </div>
            <p className="temple-login-eyebrow">{t('eyebrow')}</p>
            <h1 className="temple-login-title">
              {t('heroTitleLine1')}
              <br />
              <span>{t('heroTitleHighlight')}</span>
            </h1>
            <p className="temple-login-tagline">{t('heroTagline')}</p>
            <div className="temple-login-chips">
              <div className="temple-login-chip">
                <span className="temple-login-dot" /> {t('chipSecure')}
              </div>
              <div className="temple-login-chip">{t('chipSupport')}</div>
            </div>
          </div>

          <div className="temple-login-card">
            <span className="temple-login-corner tl" />
            <span className="temple-login-corner tr" />
            <span className="temple-login-corner bl" />
            <span className="temple-login-corner br" />

            <h2 className="temple-login-card-title">{t('tabLogin')}</h2>

            <LoginForm />

            <p className="temple-login-card-note">{t('termsNote')}</p>
          </div>

          <p className="temple-login-devotee-link">
            <Link to="/devotee/login">{t('devoteeCross')}</Link>
          </p>
        </div>
      </div>
      <div className="temple-login-footer">
        {t('brandName')} · {t('brandSubtitle')}
      </div>
    </>
  )
}

export function LoginPage() {
  return (
    <LoginLanguageProvider>
      <div className="temple-login">
        <LoginPageContent />
      </div>
    </LoginLanguageProvider>
  )
}
