import { en } from './en'
import { te } from './te'
import { hi } from './hi'
import type { SupportedLanguage, TranslationDict } from './types'

export const translations: Record<SupportedLanguage, TranslationDict> = { en, te, hi }

export type { SupportedLanguage, BundledLanguage, TranslationDict, TranslationValue, LanguageOption } from './types'
export { SUPPORTED_LANGUAGES } from './types'
