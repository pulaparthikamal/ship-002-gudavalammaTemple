import type { TempleProfile } from '@/services/api/endpoints/templeProfileApi'

/**
 * The temple's display name, localized to the current audience's language —
 * falls back to the plain English `templeName` (or the caller's fallback
 * string, e.g. an i18n key like `devotee.appName`, while the profile is
 * still loading) whenever no translation exists for the current locale yet.
 */
export function resolveTempleName(
  profile: TempleProfile | undefined,
  language: string,
  fallback: string,
): string {
  if (!profile) return fallback
  if (language !== 'en' && profile.nameTranslations?.[language]) {
    return profile.nameTranslations[language]
  }
  return profile.templeName || fallback
}
