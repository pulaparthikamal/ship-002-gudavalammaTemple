export type TranslationValue = string | { [key: string]: TranslationValue }
export type TranslationDict = { [key: string]: TranslationValue }

/** The 3 bundled/hand-written locales. Any other enabled language code is
 * fetched on demand from the backend — see Admin/src/i18n/useTranslation.ts. */
export type BundledLanguage = 'en' | 'te' | 'hi'
export type SupportedLanguage = string

export interface LanguageOption {
  code: SupportedLanguage
  label: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'hi', label: 'हिन्दी' },
]
