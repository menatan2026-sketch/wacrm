import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { ToastProvider } from '@ritmo/ui';
import { THEME_COOKIE, dirOf, isLocale } from '@/i18n/locale';
import './globals.css';
import '@/styles/app.css';
import '@/styles/me.css';
import '@/styles/schedule.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return {
    title: { default: t('name'), template: `%s · ${t('name')}` },
    description: t('tagline'),
    icons: { icon: '/brand/ritmo-app-icon.svg' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F4EF' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1311' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  const t = await getTranslations('app');
  return (
    <html
      lang={locale}
      dir={dirOf(isLocale(locale) ? locale : 'he')}
      data-theme={theme === 'light' || theme === 'dark' ? theme : undefined}
      suppressHydrationWarning
    >
      <head>
        <link rel="preload" href="/fonts/IBMPlexSansHebrew-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/IBMPlexSansHebrew-Medium.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="rt-root">
        <a className="skip-link rt-btn rt-btn--secondary" href="#main">
          {t('skip')}
        </a>
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
