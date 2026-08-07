import { useContext } from 'react'
import { DevoteeLanguageContext } from './devoteeLanguageContextValue'

export function useDevoteeLanguage() {
  const context = useContext(DevoteeLanguageContext)

  if (!context) {
    throw new Error('useDevoteeLanguage must be used within a DevoteeLanguageProvider')
  }

  return context
}
