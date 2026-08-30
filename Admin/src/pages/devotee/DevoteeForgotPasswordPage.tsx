import { DevoteeArtwork } from '@/features/devotee/components/DevoteeArtwork'
import { DevoteeForgotPasswordForm } from '@/features/devotee/components/DevoteeForgotPasswordForm'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import '@/features/devotee/styles/devoteePortal.css'

// Rendered inside DevoteeLayout (see DevoteeRoutes.tsx) — the shared
// dp-header/dp-footer/language-strip already come from there, so this page
// only contributes the actual auth-hero content, not a full standalone shell.
export function DevoteeForgotPasswordPage() {
  const { t } = useDevoteeTranslation()

  return (
    <div className="dp-auth-hero">
      <DevoteeArtwork />

      <div>
        <p className="dp-auth-eyebrow">{t('devotee.eyebrow')}</p>
        <h1 className="dp-auth-title">{t('devotee.forgotTitle')}</h1>
        <p className="dp-auth-tagline">{t('devotee.forgotSubtitle')}</p>

        <div className="dp-auth-card" style={{ maxWidth: 440 }}>
          <span className="dp-auth-corner tl" />
          <span className="dp-auth-corner tr" />
          <span className="dp-auth-corner bl" />
          <span className="dp-auth-corner br" />

          <DevoteeForgotPasswordForm />
        </div>
      </div>
    </div>
  )
}
