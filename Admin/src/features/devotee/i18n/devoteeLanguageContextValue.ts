import { createContext } from 'react'
import type { DevoteeLanguageCode, DevoteeTranslationKey } from './devoteeTranslations'

export interface DevoteeLanguageContextValue {
  language: DevoteeLanguageCode
  setLanguage: (language: DevoteeLanguageCode) => void
  t: (key: DevoteeTranslationKey) => string
}

export const DevoteeLanguageContext = createContext<DevoteeLanguageContextValue | null>(null)
