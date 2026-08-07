import { useContext } from 'react'
import { LoginLanguageContext } from './loginLanguageContextValue'

export function useLoginLanguage() {
  const context = useContext(LoginLanguageContext)

  if (!context) {
    throw new Error('useLoginLanguage must be used within a LoginLanguageProvider')
  }

  return context
}
