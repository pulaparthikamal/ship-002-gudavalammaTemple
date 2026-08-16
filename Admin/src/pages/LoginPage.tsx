import { Link } from 'react-router-dom'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { TempleArtwork } from '@/features/auth/components/TempleArtwork'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { useGetTempleProfileQuery } from '@/services/api/endpoints/templeProfileApi'
import { resolveTempleName } from '@/utils/templeName'
import '@/features/auth/styles/templeLogin.css'

function LanguageStrip() {
  const { t } = useStaffTranslation()

  return (
    <div className="temple-login-lang-strip">
      <span className="temple-login-lang-icon" aria-hidden="true">
        🕉️
      </span>
      <Link to="/" className="temple-login-back-link">
        ← {t('login.backToTempleSite')}
      </Link>
      <LanguageSwitcher audience="staff" className="temple-login-lang-select" />
    </div>
  )
}

function LoginPageContent() {
  const { t, language } = useStaffTranslation()
  const { data: templeProfile } = useGetTempleProfileQuery()
  const brandName = resolveTempleName(templeProfile, language, t('login.brandName'))

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
                <div className="temple-login-brand-name">{brandName}</div>
                <div className="temple-login-brand-subtitle">{t('login.brandSubtitle')}</div>
              </div>
            </div>
            <p className="temple-login-eyebrow">{t('login.eyebrow')}</p>
            <h1 className="temple-login-title">
              {t('login.heroTitleLine1')}
              <br />
              <span>{t('login.heroTitleHighlight')}</span>
            </h1>
            <p className="temple-login-tagline">{t('login.heroTagline')}</p>
            <div className="temple-login-chips">
              <div className="temple-login-chip">
                <span className="temple-login-dot" /> {t('login.chipSecure')}
              </div>
              <div className="temple-login-chip">{t('login.chipSupport')}</div>
            </div>
          </div>

          <div className="temple-login-card">
            <span className="temple-login-corner tl" />
            <span className="temple-login-corner tr" />
            <span className="temple-login-corner bl" />
            <span className="temple-login-corner br" />

            <h2 className="temple-login-card-title">{t('login.tabLogin')}</h2>

            <LoginForm />

            <p className="temple-login-card-note">{t('login.termsNote')}</p>
          </div>

          <p className="temple-login-devotee-link">
            <Link to="/devotee/login">{t('login.devoteeCross')}</Link>
          </p>
        </div>
      </div>
      <div className="temple-login-footer">
        {brandName} · {t('login.brandSubtitle')}
      </div>
    </>
  )
}

export function LoginPage() {
  return (
    <div className="temple-login">
      <LoginPageContent />
    </div>
  )
}
