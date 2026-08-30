import { useDevoteeTranslation, useStaffTranslation } from '@/i18n/useTranslation'
import type { TranslationAudience } from '@/i18n/useTranslation'
import { SUPPORTED_LANGUAGES } from '@/i18n/translations'
import { useGetEnabledLanguagesQuery } from '@/services/api/endpoints/languagesApi'

interface LanguageSwitcherProps {
  audience: TranslationAudience
  className?: string
}

/**
 * Staff and devotee mount separate instances of this switcher; each reads
 * and writes only its own audience's locale (see useTranslation.ts) so
 * switching one never affects the other.
 */
export function LanguageSwitcher({ audience, className }: LanguageSwitcherProps) {
  const staffTranslation = useStaffTranslation()
  const devoteeTranslation = useDevoteeTranslation()
  const { language, setLanguage, t } = audience === 'staff' ? staffTranslation : devoteeTranslation
  const { data: enabledLanguages } = useGetEnabledLanguagesQuery()

  const options =
    enabledLanguages?.map((lang) => ({ code: lang.code, label: lang.nativeName })) ?? SUPPORTED_LANGUAGES

  return (
    <select
      aria-label={t('common.language')}
      value={language}
      onChange={(event) => setLanguage(event.target.value)}
      className={
        className ??
        'rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm font-medium text-[var(--color-text)]'
      }
    >
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
