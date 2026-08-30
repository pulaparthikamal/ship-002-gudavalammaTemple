import { languageService } from '../modules/language/language.service';
import { translationService } from '../services/translation/translation.service';

/** Enabled locale codes, excluding English (the always-present source language). */
export async function getEnabledNonEnglishLocales(): Promise<string[]> {
  const enabled = await languageService.listEnabled();
  return enabled.map((lang) => lang.code).filter((code) => code !== 'en');
}

/** Generalizes templeProfile.service.ts's buildNameTranslations() for reuse across modules. */
export async function buildFieldTranslations(englishText: string, enabledLocales: string[]): Promise<Record<string, string>> {
  if (!englishText || !enabledLocales.length) return {};
  return translationService.translateToLocales(englishText, 'en', enabledLocales);
}

interface ResolveTranslatableFieldParams {
  /** Present only when the staff member was editing in English mode. */
  incomingValue?: string;
  /** Present only when the staff member was editing in a non-English locale — a partial patch, e.g. `{ te: '...' }`. */
  incomingTranslationsPatch?: Record<string, string>;
  currentValue: string;
  currentTranslations: Record<string, string>;
  enabledLocales: string[];
}

/**
 * The single write-path for a translatable field's create/update, covering
 * both edit modes a staff member can be in (see FormTranslatableInputText):
 *
 * - Editing in English and the value actually changed -> regenerate every
 *   enabled locale's translation from the new English text (mirrors
 *   templeProfile.service.ts's `nameChanged` -> buildNameTranslations()).
 * - Editing in a non-English locale -> the canonical English value is left
 *   completely untouched; only that one locale's stored translation is
 *   patched in, so a manual edit at that locale is never silently
 *   overwritten by a later unrelated English-mode save.
 */
export async function resolveTranslatableField(
  params: ResolveTranslatableFieldParams
): Promise<{ value: string; translations: Record<string, string> }> {
  const { incomingValue, incomingTranslationsPatch, currentValue, currentTranslations, enabledLocales } = params;

  if (incomingTranslationsPatch) {
    return { value: currentValue, translations: { ...currentTranslations, ...incomingTranslationsPatch } };
  }

  if (incomingValue !== undefined && incomingValue !== currentValue) {
    const translations = await buildFieldTranslations(incomingValue, enabledLocales);
    return { value: incomingValue, translations };
  }

  return {
    value: incomingValue !== undefined ? incomingValue : currentValue,
    translations: currentTranslations,
  };
}
