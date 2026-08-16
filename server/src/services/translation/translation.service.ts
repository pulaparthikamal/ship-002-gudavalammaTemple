import axios from 'axios';
import crypto from 'crypto';
import { translationConfig } from '../../config/translation.config';
import { TranslationCache } from '../../modules/translation/translationCache.model';
import { llmService } from '../llm/llm.service';
import { logger } from '../../utils/logger.util';

const hashText = (text: string): string => crypto.createHash('sha256').update(text).digest('hex');

let libreTranslateSupportedPairs: Set<string> | null = null;

/**
 * `code-targets` pairs LibreTranslate reports support for, fetched once per
 * process and cached — a transient failure just means we treat everything
 * as "unsupported" and fall through to the LLM for that call, not that we
 * keep re-checking on every translation.
 */
const getLibreTranslateSupportedPairs = async (): Promise<Set<string>> => {
  if (libreTranslateSupportedPairs) return libreTranslateSupportedPairs;

  try {
    const response = await axios.get(`${translationConfig.libreTranslateUrl}/languages`, { timeout: 5000 });
    const pairs = new Set<string>();
    for (const lang of response.data as Array<{ code: string; targets: string[] }>) {
      for (const target of lang.targets) {
        pairs.add(`${lang.code}->${target}`);
      }
    }
    libreTranslateSupportedPairs = pairs;
    return pairs;
  } catch (error) {
    logger.warn(`[translation] Could not reach LibreTranslate at ${translationConfig.libreTranslateUrl}: ${(error as Error).message}`);
    return new Set();
  }
};

const translateViaLibreTranslate = async (text: string, from: string, to: string): Promise<string> => {
  const response = await axios.post(
    `${translationConfig.libreTranslateUrl}/translate`,
    {
      q: text,
      source: from,
      target: to,
      format: 'text',
      ...(translationConfig.libreTranslateApiKey ? { api_key: translationConfig.libreTranslateApiKey } : {}),
    },
    { timeout: 10000 }
  );
  return response.data?.translatedText ?? text;
};

const translateViaLlm = async (text: string, from: string, to: string): Promise<string> => {
  const result = await llmService.generateText(
    `Translate the following text from language code "${from}" to language code "${to}". ` +
      `Output ONLY the translated text, with no explanations, no quotes, and no extra commentary.\n\nText: ${text}`
  );
  return result.trim() || text;
};

export const translationService = {
  /**
   * Translate `text` from `from` to `to`, using the cache first, then
   * LibreTranslate (if it's configured as primary and supports the pair),
   * falling back to the LLM service otherwise. Caches the result.
   */
  async translateText(text: string, from: string, to: string): Promise<string> {
    if (!text || from === to) return text;

    const sourceHash = hashText(text);
    const cached = await TranslationCache.findOne({ sourceHash, sourceLocale: from, targetLocale: to });
    if (cached) return cached.translatedText;

    let translated: string | null = null;

    if (translationConfig.provider === 'libretranslate') {
      const supportedPairs = await getLibreTranslateSupportedPairs();
      if (supportedPairs.has(`${from}->${to}`)) {
        try {
          translated = await translateViaLibreTranslate(text, from, to);
        } catch (error) {
          logger.warn(`[translation] LibreTranslate failed for ${from}->${to}, falling back to LLM: ${(error as Error).message}`);
        }
      }
    }

    if (translated === null) {
      try {
        translated = await translateViaLlm(text, from, to);
      } catch (error) {
        logger.error(`[translation] LLM translation failed for ${from}->${to}: ${(error as Error).message}`);
        return text;
      }
    }

    await TranslationCache.findOneAndUpdate(
      { sourceHash, sourceLocale: from, targetLocale: to },
      { $setOnInsert: { sourceHash, sourceLocale: from, targetLocale: to, sourceText: text, translatedText: translated } },
      { upsert: true }
    );

    return translated;
  },

  async translateToLocales(text: string, from: string, targetLocales: string[]): Promise<Record<string, string>> {
    const results = await Promise.all(
      targetLocales.map(async (locale) => [locale, await this.translateText(text, from, locale)] as const)
    );
    return Object.fromEntries(results);
  },

  /**
   * Translate a batch of `{key, text}` entries (a frontend's flattened
   * English string dictionary) into `targetLocale`, returning `{key: text}`.
   * Used by `POST /translations/:locale` for on-demand UI-string translation.
   */
  async translateEntries(entries: Array<{ key: string; text: string }>, targetLocale: string): Promise<Record<string, string>> {
    const results = await Promise.all(
      entries.map(async ({ key, text }) => [key, await this.translateText(text, 'en', targetLocale)] as const)
    );
    return Object.fromEntries(results);
  },

  /**
   * Called (fire-and-forget) when a language is newly enabled — pre-warms
   * the cache for backend-owned translatable content (menu titles,
   * announcements, temple profile) so the first admin/devotee to switch to
   * it isn't the one paying the translation latency.
   */
  async populateLocale(targetLocale: string): Promise<void> {
    const { Menu } = await import('../../modules/menu/menu.model');
    const { Announcement } = await import('../../modules/announcement/announcement.model');
    const { TempleProfile } = await import('../../modules/templeProfile/templeProfile.model');

    const menus = await Menu.find();
    for (const menu of menus) {
      await this.translateText(menu.title, 'en', targetLocale);
      for (const sub of menu.submenu) {
        await this.translateText(sub.title, 'en', targetLocale);
      }
    }

    const announcements = await Announcement.find({ active: true });
    for (const announcement of announcements) {
      await this.translateText(announcement.title, 'en', targetLocale);
      await this.translateText(announcement.body, 'en', targetLocale);
    }

    const profile = await TempleProfile.findOne();
    if (profile) {
      if (profile.templeName) await this.translateText(profile.templeName, 'en', targetLocale);
      if (profile.tagline) await this.translateText(profile.tagline, 'en', targetLocale);
    }
  },
};
