import { useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { buildPrimaryThemeVars } from '@/utils/themeColors'

export function ThemeController() {
  const { primaryColor, resolvedTheme, themePreference } = useTheme()

  useEffect(() => {
    const root = document.documentElement
    const primaryThemeVars = buildPrimaryThemeVars(primaryColor, resolvedTheme)

    root.dataset.theme = resolvedTheme
    root.dataset.themePreference = themePreference
    root.style.colorScheme = resolvedTheme
    Object.entries(primaryThemeVars).forEach(([variableName, variableValue]) => {
      root.style.setProperty(variableName, variableValue)
    })
  }, [primaryColor, resolvedTheme, themePreference])

  return null
}
