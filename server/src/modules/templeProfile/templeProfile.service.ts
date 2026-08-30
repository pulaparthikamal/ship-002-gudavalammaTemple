import { TempleProfile, ITempleTiming } from './templeProfile.model';
import { languageService } from '../language/language.service';
import { translationService } from '../../services/translation/translation.service';

const DEFAULT_TIMINGS: ITempleTiming[] = [
  { label: 'Suprabhata Seva', time: '4:30 AM' },
  { label: 'Sarva Darshan', time: '6:00 AM – 9:00 PM' },
  { label: 'Archana / Abhishekam', time: '7:00 – 10:00 AM' },
  { label: 'Ekanta Seva', time: '9:15 PM' },
];

/**
 * There's no manual per-locale edit UI for the temple's name (unlike the
 * screen-customizer widgets, which do have one) — so unlike pageContent's
 * "never overwrite" auto-fill, it's safe (and necessary) to fully regenerate
 * every locale whenever the English name itself changes, or a stale
 * translation of the *old* name would linger forever.
 */
async function buildNameTranslations(templeName: string): Promise<Record<string, string>> {
  const enabledLanguages = await languageService.listEnabled();
  const targetLocales = enabledLanguages.map((lang) => lang.code).filter((code) => code !== 'en');
  if (!targetLocales.length) return {};
  return translationService.translateToLocales(templeName, 'en', targetLocales);
}

export const templeProfileService = {
  async getOrCreate() {
    let profile = await TempleProfile.findOne();
    if (!profile) {
      profile = await TempleProfile.create({
        templeName: 'Gudavalamma Temple',
        tagline: 'Devotee Services Portal',
        address: '10-19-54, Temple Street, Gudavalli, Andhra Pradesh, India',
        helpline: '24x7 Devotee Helpline: 1800-000-0000',
        socialLinks: {},
        timings: DEFAULT_TIMINGS,
        contactEmails: [],
      });
    }

    // Backfills a pre-existing profile (or one saved before Phase 15+'s
    // nameTranslations field existed) — only runs once, since a successful
    // fill makes this a no-op on every subsequent read. Never fails the
    // (public, every-page-load) profile read if translation is unavailable.
    if (!profile.nameTranslations || Object.keys(profile.nameTranslations).length === 0) {
      try {
        const translations = await buildNameTranslations(profile.templeName);
        if (Object.keys(translations).length) {
          profile.nameTranslations = translations;
          await profile.save();
        }
      } catch {
        // Translation backend unreachable — leave nameTranslations empty for
        // now; the frontend already falls back to the English name.
      }
    }

    return profile;
  },

  async update(data: Partial<{
    templeName: string;
    tagline: string;
    address: string;
    helpline: string;
    logoUrl: string;
    deityImageUrl: string;
    upiId: string;
    socialLinks: Record<string, string>;
    timings: ITempleTiming[];
    contactEmails: string[];
  }>) {
    const profile = await this.getOrCreate();
    const nameChanged = data.templeName !== undefined && data.templeName !== profile.templeName;

    Object.assign(profile, data, { updated: new Date() });

    if (nameChanged) {
      try {
        profile.nameTranslations = await buildNameTranslations(profile.templeName);
      } catch {
        // Translation backend unreachable — clear rather than keep stale
        // translations of the *old* name; the frontend falls back to the
        // (correct, just-saved) English name, and getOrCreate()'s backfill
        // will retry filling this in on a future read.
        profile.nameTranslations = {};
      }
    }

    await profile.save();
    return profile;
  },
};
