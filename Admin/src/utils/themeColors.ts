import type { ResolvedTheme } from '@/hooks/useTheme'

export const DEFAULT_PRIMARY_COLOR = '#2563eb'

/* ─── Chart / Graph color palette ────────────────────────────────────────────
 * Single source of truth for every metric color used across the Dashboard
 * and Reports pages.  Import `CHART_COLORS` wherever a graph color is needed.
 * ──────────────────────────────────────────────────────────────────────────── */

export const CHART_COLORS = {
  cpu: {
    stroke: '#2563eb',
    gradient: 'from-blue-600 to-indigo-700',
  },
  memory: {
    stroke: '#059669',
    gradient: 'from-emerald-500 to-teal-700',
  },
  disk: {
    stroke: '#d97706',
    gradient: 'from-amber-400 to-orange-600',
  },
  load: {
    stroke: '#06b6d4',
    gradient: 'from-emerald-400 to-green-600',
  },
  download: {
    stroke: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-700',
  },
  upload: {
    stroke: '#ef4444',
    gradient: 'from-rose-500 to-red-700',
  },
} as const

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function normalizeHexColor(value: string | null | undefined, fallback = DEFAULT_PRIMARY_COLOR) {
  if (!value) {
    return fallback
  }

  const trimmed = value.trim()
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  const shortHexMatch = /^#([\da-fA-F]{3})$/.exec(prefixed)

  if (shortHexMatch) {
    const expanded = shortHexMatch[1]
      .split('')
      .map((channel) => `${channel}${channel}`)
      .join('')

    return `#${expanded}`.toLowerCase()
  }

  return /^#[\da-fA-F]{6}$/.test(prefixed) ? prefixed.toLowerCase() : fallback
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex)
  const parsed = Number.parseInt(normalized.slice(1), 16)

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  }
}

function toHex(value: number) {
  return clampChannel(value).toString(16).padStart(2, '0')
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function mixHexColors(baseHex: string, targetHex: string, weight: number) {
  const base = hexToRgb(baseHex)
  const target = hexToRgb(targetHex)

  return rgbToHex(
    base.r + (target.r - base.r) * weight,
    base.g + (target.g - base.g) * weight,
    base.b + (target.b - base.b) * weight,
  )
}

function getRelativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function getContrastRatio(firstHex: string, secondHex: string) {
  const first = getRelativeLuminance(firstHex)
  const second = getRelativeLuminance(secondHex)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)

  return (lighter + 0.05) / (darker + 0.05)
}

function getAccessibleTextColor(backgroundHex: string) {
  const whiteContrast = getContrastRatio(backgroundHex, '#ffffff')
  const darkContrast = getContrastRatio(backgroundHex, '#050505')

  return whiteContrast >= darkContrast ? '#ffffff' : '#050505'
}

export function buildPrimaryThemeVars(primaryColorValue: string, resolvedTheme: ResolvedTheme) {
  const primaryColor = normalizeHexColor(primaryColorValue)
  const hoverTarget = resolvedTheme === 'dark' ? '#ffffff' : '#000000'
  const activeTarget = resolvedTheme === 'dark' ? '#ffffff' : '#000000'
  const hoverWeight = resolvedTheme === 'dark' ? 0.14 : 0.12
  const activeWeight = resolvedTheme === 'dark' ? 0.24 : 0.2
  const { r, g, b } = hexToRgb(primaryColor)

  return {
    '--primary-color': primaryColor,
    '--primary-color-hover': mixHexColors(primaryColor, hoverTarget, hoverWeight),
    '--primary-color-active': mixHexColors(primaryColor, activeTarget, activeWeight),
    '--primary-color-soft': `rgba(${r}, ${g}, ${b}, ${resolvedTheme === 'dark' ? 0.18 : 0.12})`,
    '--primary-color-ring': `rgba(${r}, ${g}, ${b}, ${resolvedTheme === 'dark' ? 0.28 : 0.2})`,
    '--primary-color-contrast': getAccessibleTextColor(primaryColor),
    '--primary-color-rgb': `${r} ${g} ${b}`,
  } as const
}
