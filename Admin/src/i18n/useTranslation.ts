import { useCallback, useEffect, useMemo, useRef } from 'react'
import { setStaffLocale, setDevoteeLocale, setDynamicTranslations } from '@/features/preferences/preferencesSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useTranslateEntriesMutation } from '@/services/api/endpoints/translationsApi'
import { translations } from './translations'
import { flattenDict, toEntries } from './flatten'
import type { BundledLanguage, TranslationValue } from './translations'

export type TranslationAudience = 'staff' | 'devotee'

const BUNDLED_CODES: BundledLanguage[] = ['en', 'te', 'hi']

function isBundled(locale: string): locale is BundledLanguage {
  return BUNDLED_CODES.includes(locale as BundledLanguage)
}

function normalizeLanguage(locale: string | undefined): string {
  if (!locale) return 'en'
  // Legacy default value ('en-US') predates dynamic locale support.
  if (locale === 'en-US') return 'en'
  return locale
}

function resolveKey(dict: TranslationValue, key: string): string | undefined {
  const parts = key.split('.')
  let current: TranslationValue = dict

  for (const part of parts) {
    if (typeof current === 'string') return undefined
    const next = current[part]
    if (next === undefined) return undefined
    current = next
  }

  return typeof current === 'string' ? current : undefined
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, paramName: string) => {
    const value = params[paramName]
    return value === undefined ? match : String(value)
  })
}

const englishFlat = flattenDict(translations.en)

/**
 * Shared implementation behind useStaffTranslation()/useDevoteeTranslation().
 * Staff and devotee locale selection is independent (see PreferencesState) —
 * this hook only ever reads/writes the one field matching `audience`, so
 * switching one audience's language can never affect the other, even when
 * both are mounted at once (e.g. a staff member previewing the devotee site).
 */
function useTranslationForAudience(audience: TranslationAudience) {
  const locale = useAppSelector((state) =>
    audience === 'staff' ? state.preferences.staffLocale : state.preferences.devoteeLocale,
  )
  // Defends against stale persisted state from before these fields existed
  // (redux-persist's default reconciler doesn't backfill missing nested
  // keys on rehydration) — without this, an old session crashes every t() call.
  const dynamicTranslations = useAppSelector((state) => state.preferences.dynamicTranslations) ?? {}
  const dispatch = useAppDispatch()
  const [translateEntries] = useTranslateEntriesMutation()
  const language = normalizeLanguage(locale)
  const fetchingRef = useRef<Set<string>>(new Set())

  // For any enabled locale that isn't one of the 3 bundled dictionaries,
  // fetch (once) the full translated dictionary from the backend and cache
  // it in Redux (persisted), so subsequent visits are instant. The cache is
  // shared across both audiences (keyed by locale, not audience) — staff and
  // devotee namespaces never collide, so this de-dupes automatically when
  // both happen to be set to the same non-bundled locale.
  useEffect(() => {
    if (isBundled(language)) return
    if (dynamicTranslations[language]) return
    if (fetchingRef.current.has(language)) return

    fetchingRef.current.add(language)
    translateEntries({ locale: language, entries: toEntries(englishFlat) })
      .unwrap()
      .then((dict) => {
        dispatch(setDynamicTranslations({ locale: language, dict }))
      })
      .catch(() => {
        // Leave dynamicTranslations[language] unset so English fallback is
        // used; a future render will retry (translation backend may not be
        // reachable yet — see server/src/services/translation).
      })
      .finally(() => {
        fetchingRef.current.delete(language)
      })
  }, [language, dynamicTranslations, translateEntries, dispatch])

  const setLanguage = useCallback(
    (next: string) => {
      dispatch(audience === 'staff' ? setStaffLocale(next) : setDevoteeLocale(next))
    },
    [dispatch],
  )

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      // A dot-free key is a "content" key: the literal English page string
      // itself (e.g. t('Donors')), used for the long tail of per-page titles/
      // headers/labels across models/*.tsx and pages/*.tsx — see
      // translations/{en,te,hi}.ts's `content` namespace. This avoids having
      // to hand-invent a namespaced key for every one of these strings; the
      // string doubles as its own English fallback, so an untranslated
      // content key degrades to plain (correct) English instead of a raw key.
      const lookupKey = key.includes('.') ? key : `content.${key}`

      if (isBundled(language)) {
        const value = resolveKey(translations[language], lookupKey) ?? resolveKey(translations.en, lookupKey) ?? key
        return interpolate(value, params)
      }

      const value = dynamicTranslations[language]?.[lookupKey] ?? resolveKey(translations.en, lookupKey) ?? key
      return interpolate(value, params)
    },
    [language, dynamicTranslations],
  )

  return useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])
}

export function useStaffTranslation() {
  return useTranslationForAudience('staff')
}

export function useDevoteeTranslation() {
  return useTranslationForAudience('devotee')
}
