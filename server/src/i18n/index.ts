import { authI18n } from './en/auth.i18n';
import { userI18n } from './en/user.i18n';
import { roleI18n } from './en/role.i18n';
import { menuI18n } from './en/menu.i18n';
import { settingsI18n } from './en/settings.i18n';
import { commonI18n } from './en/common.i18n';
import { tokenI18n } from './en/token.i18n';
import { patientI18n } from './en/patient.i18n';
import { rcmI18n } from './en/rcm.i18n';
import { toneI18n } from './en/tone.i18n';

const translations: Record<string, any> = {
  en: {
    auth: authI18n,
    user: userI18n,
    role: roleI18n,
    menu: menuI18n,
    settings: settingsI18n,
    common: commonI18n,
    token: tokenI18n,
    patient: patientI18n,
    ...rcmI18n,
    tone: toneI18n,
  },
};

export const t = (key: string, params?: Record<string, string | number>, locale: string = 'en'): string => {
  const keys = key.split('.');
  
  let result = translations[locale];
  
  if (!result) {
    result = translations['en']; // Fallback to English
  }

  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = result[k];
    } else {
      return key; // Return the key itself if translation is missing
    }
  }

  if (typeof result !== 'string') {
    return key;
  }

  let finalString = result;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      finalString = finalString.replace(`{${paramKey}}`, String(paramValue));
    }
  }

  return finalString;
};
