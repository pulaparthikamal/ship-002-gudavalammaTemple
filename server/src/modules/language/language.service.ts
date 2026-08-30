import { Language } from './language.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

/**
 * All 22 languages of the Eighth Schedule of the Indian Constitution, plus
 * English as the app's base/source language. Codes prefer ISO 639-1; a
 * handful of scheduled languages have no two-letter code and use their
 * ISO 639-2/3 code instead (brx, doi, kok, mai, mni, sat).
 */
const DEFAULT_LANGUAGES: Array<{ code: string; name: string; nativeName: string; enabled: boolean; isDefault?: boolean }> = [
  { code: 'en', name: 'English', nativeName: 'English', enabled: true, isDefault: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', enabled: true },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', enabled: true },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', enabled: true },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', enabled: true },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', enabled: true },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', enabled: true },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', enabled: true },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', enabled: true },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', enabled: true },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', enabled: false },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', enabled: false },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', enabled: false },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', enabled: false },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', enabled: false },
  { code: 'ks', name: 'Kashmiri', nativeName: 'کٲشُر', enabled: false },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', enabled: false },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', enabled: false },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', enabled: false },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', enabled: false },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', enabled: false },
  { code: 'mni', name: 'Manipuri', nativeName: 'মৈতৈলোন্', enabled: false },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', enabled: false },
];

export const languageService = {
  async seedLanguages(): Promise<number> {
    let count = 0;
    for (const lang of DEFAULT_LANGUAGES) {
      await Language.findOneAndUpdate(
        { code: lang.code },
        { $setOnInsert: lang },
        { upsert: true, new: true }
      );
      count += 1;
    }
    return count;
  },

  async listAll() {
    return Language.find().sort({ isDefault: -1, enabled: -1, name: 1 });
  },

  async listEnabled() {
    return Language.find({ enabled: true }).sort({ isDefault: -1, name: 1 });
  },

  async setEnabled(code: string, enabled: boolean, locale: string) {
    const language = await Language.findOne({ code });
    if (!language) {
      throw new AppError(t('language.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    if (language.isDefault && !enabled) {
      throw new AppError(t('language.cannotDisableDefault', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }
    language.enabled = enabled;
    language.updated = new Date();
    await language.save();
    return language;
  },
};
