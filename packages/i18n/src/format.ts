import type { AppLocale } from "./config";

export const DEFAULT_TIME_ZONE = "Asia/Jerusalem";

const intlLocale = (locale: AppLocale) => (locale === "he" ? "he-IL" : locale === "ru" ? "ru-RU" : "en-IL");

/** Format integer minor units as currency. The currency comes from the data, never the locale. */
export function formatMoney(amountMinor: number, currency: string, locale: AppLocale): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency }).format(amountMinor / 100);
}

export function formatNumber(value: number, locale: AppLocale, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits }).format(value);
}

export function formatPercent(ratio: number, locale: AppLocale): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 1 }).format(ratio);
}

export function formatDate(date: Date | string, locale: AppLocale, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone }).format(new Date(date));
}

export function formatDateTime(date: Date | string, locale: AppLocale, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(date));
}

export type LengthUnit = "mm" | "cm" | "in";
export const MM_PER: Record<LengthUnit, number> = { mm: 1, cm: 10, in: 25.4 };

export const toMm = (value: number, unit: LengthUnit): number => value * MM_PER[unit];
export const fromMm = (valueMm: number, unit: LengthUnit): number => valueMm / MM_PER[unit];

/** Number part of a measurement, locale-formatted. The unit label comes from the catalog. */
export function formatLength(valueMm: number, unit: LengthUnit, locale: AppLocale): string {
  return formatNumber(fromMm(valueMm, unit), locale, unit === "mm" ? 1 : 2);
}

/**
 * Parse user decimal input. Accepts both "." and "," as the decimal separator (Russian users
 * type commas) and ignores spaces used as thousands separators. Returns null for invalid input.
 */
export function parseDecimal(input: string): number | null {
  const cleaned = input.trim().replace(/[\s  ]/g, "");
  if (!/^-?\d+([.,]\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}
