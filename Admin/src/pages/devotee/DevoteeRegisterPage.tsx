import { Link } from 'react-router-dom'
import { DevoteeArtwork } from '@/features/devotee/components/DevoteeArtwork'
import { DevoteeRegisterForm } from '@/features/devotee/components/DevoteeRegisterForm'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useGetTempleProfileQuery } from '@/services/api/endpoints/templeProfileApi'
import { resolveTempleName } from '@/utils/templeName'
import '@/features/devotee/styles/devoteePortal.css'

// Rendered inside DevoteeLayout (see DevoteeRoutes.tsx) — the shared
// dp-header/dp-footer/language-strip already come from there, so this page
// only contributes the actual auth-hero content, not a full standalone shell.
export function DevoteeRegisterPage() {
  const { t, language } = useDevoteeTranslation()
  const { data: templeProfile } = useGetTempleProfileQuery()

  return (
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
                {resolveTempleName(templeProfile, language, t('devotee.appName'))}
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
                {t('devotee.registerBrandSubtitle')}
              </div>
            </div>
          </div>

          <p className="dp-auth-eyebrow">{t('devotee.eyebrow')}</p>
          <h1 className="dp-auth-title">
            {t('devotee.loginHeroLine1')}
            <br />
            <span>{t('devotee.loginHeroHighlight')}</span>
          </h1>
          <p className="dp-auth-tagline">{t('devotee.registerSubtitle')}</p>

          <div className="dp-auth-card" style={{ marginTop: 26, maxWidth: 480 }}>
            <span className="dp-auth-corner tl" />
            <span className="dp-auth-corner tr" />
            <span className="dp-auth-corner bl" />
            <span className="dp-auth-corner br" />

            <h2 className="dp-auth-card-title">{t('devotee.registerTitle')}</h2>

            <DevoteeRegisterForm />
          </div>

          <p className="dp-auth-footer-link" style={{ marginTop: 14 }}>
            <Link to="/login">{t('devotee.loginStaffCross')}</Link>
          </p>
        </div>
      </div>
  )
}
