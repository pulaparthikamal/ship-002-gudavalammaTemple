import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { devoteeTranslations } from './devoteeTranslations'
import type { DevoteeLanguageCode } from './devoteeTranslations'
import { DevoteeLanguageContext } from './devoteeLanguageContextValue'
import type { DevoteeLanguageContextValue } from './devoteeLanguageContextValue'

const STORAGE_KEY = 'devotee:language'

function readStoredLanguage(): DevoteeLanguageCode {
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

export function DevoteeLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<DevoteeLanguageCode>(readStoredLanguage)

  const value = useMemo<DevoteeLanguageContextValue>(() => {
    const setLanguage = (next: DevoteeLanguageCode) => {
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
      t: (key) => devoteeTranslations[language][key] ?? devoteeTranslations.en[key],
    }
  }, [language])

  return <DevoteeLanguageContext.Provider value={value}>{children}</DevoteeLanguageContext.Provider>
}
