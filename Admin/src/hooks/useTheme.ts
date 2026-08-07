import { useEffect, useMemo, useState } from 'react'
import { selectPreferences, setPrimaryColor, setTheme } from '@/features/preferences/preferencesSlice'
import type { AppTheme } from '@/features/preferences/preferencesSlice'
import { useAppDispatch, useAppSelector } from './redux'
import { normalizeHexColor } from '@/utils/themeColors'

export type ResolvedTheme = 'light' | 'dark'

function getSystemResolvedTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(theme: AppTheme, systemTheme: ResolvedTheme): ResolvedTheme {
  return theme === 'system' ? systemTheme : theme
}

export function useTheme() {
  const dispatch = useAppDispatch()
  const preferences = useAppSelector(selectPreferences)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemResolvedTheme())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const resolvedTheme = useMemo(
    () => resolveTheme(preferences.theme, systemTheme),
    [preferences.theme, systemTheme],
  )

  return {
    themePreference: preferences.theme,
    resolvedTheme,
    primaryColor: normalizeHexColor(preferences.primaryColor),
    setAppTheme: (theme: AppTheme) => dispatch(setTheme(theme)),
    setPrimaryThemeColor: (color: string) => dispatch(setPrimaryColor(normalizeHexColor(color))),
    toggleTheme: () => dispatch(setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')),
  }
}
