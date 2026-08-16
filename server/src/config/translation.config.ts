import env from 'env-var';

export interface TranslationConfig {
  provider: 'libretranslate' | 'llm';
  libreTranslateUrl: string;
  libreTranslateApiKey: string;
}

export const translationConfig: TranslationConfig = {
  provider: env.get('TRANSLATION_PROVIDER').default('libretranslate').asEnum(['libretranslate', 'llm']),
  libreTranslateUrl: env.get('LIBRETRANSLATE_URL').default('http://localhost:5001').asString(),
  libreTranslateApiKey: env.get('LIBRETRANSLATE_API_KEY').default('').asString(),
};
