import { createContext } from 'react'
import type { LoginLanguageCode, LoginTranslationKey } from './loginTranslations'

export interface LoginLanguageContextValue {
  language: LoginLanguageCode
  setLanguage: (language: LoginLanguageCode) => void
  t: (key: LoginTranslationKey) => string
}

export const LoginLanguageContext = createContext<LoginLanguageContextValue | null>(null)
