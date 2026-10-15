export const LOCALES = ['he', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'he';
export const LOCALE_COOKIE = 'ritmo_locale';
export const THEME_COOKIE = 'ritmo_theme';
export type Theme = 'system' | 'light' | 'dark';

export function isLocale(v: unknown): v is Locale {
  return v === 'he' || v === 'en';
}

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

/** BCP 47 tag for Intl formatting: Israeli conventions in both languages. */
export function intlLocale(locale: Locale): string {
  return locale === 'he' ? 'he-IL' : 'en-IL';
}
