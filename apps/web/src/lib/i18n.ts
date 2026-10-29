import "server-only";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale, type AppLocale } from "@mfg/i18n";

/** Validate the [locale] segment and enable static locale for next-intl in this request. */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

/** Localized display name from admin-managed catalog JSON (falls back to English, then the code). */
export function catalogName(
  i18n: Partial<Record<string, { name: string; description?: string }>> | null | undefined,
  locale: AppLocale,
  fallback: string,
) {
  return i18n?.[locale]?.name ?? i18n?.en?.name ?? fallback;
}
export function catalogDescription(
  i18n: Partial<Record<string, { name: string; description?: string }>> | null | undefined,
  locale: AppLocale,
) {
  return i18n?.[locale]?.description ?? i18n?.en?.description ?? "";
}

/** Wrap an LTR value (order number, tracking code) in Unicode first-strong isolates for safe interpolation into RTL text. */
export const isolate = (value: string) => `⁨${value}⁩`;
