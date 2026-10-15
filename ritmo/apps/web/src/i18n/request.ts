import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './locale';

export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  let locale: Locale = DEFAULT_LOCALE;
  if (isLocale(fromCookie)) {
    locale = fromCookie;
  } else {
    const accept = (await headers()).get('accept-language') ?? '';
    if (/^en\b/i.test(accept) && !/\bhe\b/i.test(accept)) locale = 'en';
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Asia/Jerusalem',
  };
});
