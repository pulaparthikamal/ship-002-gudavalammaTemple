import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { loginTranslations } from './loginTranslations'
import type { LoginLanguageCode } from './loginTranslations'
import { LoginLanguageContext } from './loginLanguageContextValue'
import type { LoginLanguageContextValue } from './loginLanguageContextValue'

const STORAGE_KEY = 'auth:loginLanguage'

function readStoredLanguage(): LoginLanguageCode {
  if (typeof window === 'undefined') {
    return 'en'
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'te' || stored === 'hi' || stored === 'en' ? stored : 'en'
  } catch {
    return 'en'
  }
}

export function LoginLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LoginLanguageCode>(readStoredLanguage)

  const value = useMemo<LoginLanguageContextValue>(() => {
    const setLanguage = (next: LoginLanguageCode) => {
      setLanguageState(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Language preference is a convenience only; ignore storage failures.
      }
    }

    return {
      language,
      setLanguage,
      t: (key) => loginTranslations[language][key] ?? loginTranslations.en[key],
    }
  }, [language])

  return <LoginLanguageContext.Provider value={value}>{children}</LoginLanguageContext.Provider>
}
