import { Request, Response, NextFunction } from 'express';
import { languageService } from '../modules/language/language.service';

/**
 * Negotiates req.locale from the Accept-Language header (now populated by
 * the frontend's axios interceptor with the in-app staff/devotee language
 * switcher's selection — see Admin/src/services/api/axiosInstance.ts) against
 * every currently-enabled Language, not just the 3 bundled ones. Runs before
 * authMiddleware, so it can't yet consider an authenticated user's own
 * preferredLocale.
 *
 * Enabled-language codes are cached in-process for a short TTL rather than
 * queried per-request — same "cache the provider's supported list" pattern
 * already used by translationService for LibreTranslate's /languages call.
 */
const CACHE_TTL_MS = 60_000;
let cachedCodes: string[] = ['en', 'te', 'hi'];
let cachedAt = 0;

async function getEnabledLocaleCodes(): Promise<string[]> {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS) {
    return cachedCodes;
  }

  try {
    const enabled = await languageService.listEnabled();
    cachedCodes = enabled.map((lang) => lang.code);
    cachedAt = now;
  } catch {
    // DB not reachable yet (e.g. very early boot) — keep the last-known
    // list rather than failing every request.
  }

  return cachedCodes;
}

export const localeMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  const acceptedLanguages = req.acceptsLanguages() || [];
  const enabledCodes = await getEnabledLocaleCodes();
  let resolvedLocale = 'en';

  for (const lang of acceptedLanguages) {
    const normalized = lang.toLowerCase();
    const match = enabledCodes.find((code) => normalized.startsWith(code));
    if (match) {
      resolvedLocale = match;
      break;
    }
  }

  req.locale = resolvedLocale;
  next();
};
