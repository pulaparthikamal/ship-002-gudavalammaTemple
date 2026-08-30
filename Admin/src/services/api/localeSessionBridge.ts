/**
 * Lets axiosInstance.ts (a plain module, outside React) read the current
 * staff/devotee locale to attach as an Accept-Language header — mirrors
 * authSessionBridge.ts's resolver-with-localStorage-fallback pattern so the
 * backend's locale negotiation (server/src/app.ts) finally reflects the
 * in-app language switcher instead of only the browser's default language.
 */
export type RequestAudience = 'staff' | 'devotee'

export interface LocaleSnapshot {
  staffLocale: string
  devoteeLocale: string
}

type LocaleSnapshotResolver = () => LocaleSnapshot

const defaultSnapshot: LocaleSnapshot = { staffLocale: 'en', devoteeLocale: 'en' }

let snapshotResolver: LocaleSnapshotResolver | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseJson<T>(value: string | null): T | null {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function readLocalStorageItem(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function readPersistedLocaleSnapshot(): LocaleSnapshot {
  if (typeof window === 'undefined') {
    return defaultSnapshot
  }

  const persistedRoot = parseJson<Record<string, string>>(readLocalStorageItem('persist:root'))
  const rawPreferences = persistedRoot?.preferences
  const persistedPreferences = parseJson<Record<string, unknown>>(rawPreferences ?? null)

  if (!isRecord(persistedPreferences)) {
    return defaultSnapshot
  }

  return {
    staffLocale: typeof persistedPreferences.staffLocale === 'string' ? persistedPreferences.staffLocale : 'en',
    devoteeLocale: typeof persistedPreferences.devoteeLocale === 'string' ? persistedPreferences.devoteeLocale : 'en',
  }
}

export function setLocaleSnapshotResolver(resolver: LocaleSnapshotResolver) {
  snapshotResolver = resolver
}

export function getLocaleSnapshot(): LocaleSnapshot {
  return snapshotResolver?.() ?? readPersistedLocaleSnapshot()
}

/** `/devotee/*` and the home page `/` are the devotee audience; everything else is staff. */
export function resolveAudienceFromPath(pathname: string): RequestAudience {
  return pathname === '/' || pathname.startsWith('/devotee') ? 'devotee' : 'staff'
}
