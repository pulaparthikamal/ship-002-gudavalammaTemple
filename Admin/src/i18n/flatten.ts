import type { TranslationDict, TranslationValue } from './translations/types'

/**
 * Flattens a nested translation dictionary into dot-path key -> text pairs,
 * e.g. `{devotee: {navHome: 'Home'}}` -> `{'devotee.navHome': 'Home'}`.
 * Used to ship the bundled English dictionary to the backend for on-demand
 * translation into locales that don't have a hand-written static file.
 */
export function flattenDict(dict: TranslationDict, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(dict)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      result[fullKey] = value
    } else {
      Object.assign(result, flattenDict(value as TranslationDict, fullKey))
    }
  }

  return result
}

export function toEntries(flat: Record<string, string>): Array<{ key: string; text: string }> {
  return Object.entries(flat).map(([key, text]) => ({ key, text }))
}

export type { TranslationValue }
