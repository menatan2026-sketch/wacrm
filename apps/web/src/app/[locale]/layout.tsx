import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { directionOf, locales } from "@mfg/i18n";
import { MotionProvider } from "@mfg/motion";
import { useLocaleParam } from "@/lib/i18n";
import "../globals.css";

export const MOTION_COOKIE = "mfg_motion";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: { default: `${t("brand")} · ${t("tagline")}`, template: `%s · ${t("brand")}` },
    description: t("tagline"),
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])) },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111418" };

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await useLocaleParam(params);
  const messages = await getMessages();
  const t = await getTranslations("common");
  const motionPref = (await cookies()).get(MOTION_COOKIE)?.value;
  const preference = motionPref === "reduced" || motionPref === "full" ? motionPref : "system";
  return (
    <html lang={locale} dir={directionOf(locale)} data-motion={preference === "system" ? undefined : preference} suppressHydrationWarning>
      <body className="bg-surface-base text-text-primary antialiased">
        <a href="#main" className="sr-only z-50 rounded-s bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider messages={messages} locale={locale} timeZone="Asia/Jerusalem">
          <MotionProvider preference={preference}>{children}</MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
