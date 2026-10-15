import { formatDuration, formatMoney, localDate, localTime } from '@ritmo/core';

export const TZ = 'Asia/Jerusalem';

export const fmtTime = (d: Date | string | null | undefined, tz = TZ) => (d ? localTime(new Date(d), tz) : '');
export const fmtDuration = (minutes: number) => formatDuration(minutes);
export const fmtMoney = (minor: number | bigint, locale: string) =>
  formatMoney(Number(minor), locale === 'he' ? 'he-IL' : 'en-IL');
export const todayLocal = (tz = TZ) => localDate(new Date(), tz);

/** "Wednesday, 14 October" in the user's language, Israeli conventions. */
export function fmtLongDate(date: Date | string, locale: string, tz = TZ) {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: tz,
  }).format(typeof date === 'string' ? new Date(`${date}T12:00:00Z`) : date);
}

/** "Thu 16 Oct" / "ה׳ 16.10" */
export function fmtShortDate(dateStr: string, locale: string) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (locale === 'he') {
    const wd = new Intl.DateTimeFormat('he-IL', { weekday: 'narrow', timeZone: 'UTC' }).format(d);
    return `${wd}׳ ${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
  }
  return new Intl.DateTimeFormat('en-IL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

export function fmtWeekday(dateStr: string, locale: string, style: 'long' | 'short' | 'narrow' = 'long') {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', { weekday: style, timeZone: 'UTC' }).format(
    new Date(`${dateStr}T12:00:00Z`),
  );
}

/** "12–18.10" style range for week headers. */
export function fmtRange(start: string, end: string, locale: string) {
  const f = (s: string) => {
    const d = new Date(`${s}T12:00:00Z`);
    return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
  };
  return locale === 'he' ? `${f(start)}–${f(end)}` : `${f(start)} – ${f(end)}`;
}

export const pct = (n: number) => `${Math.round(n)}%`;

/**
 * Bidi-isolates a value inside translated text (U+2068 FSI … U+2069 PDI),
 * the plain-string equivalent of <bdi>: "07:00–15:00" never flips in Hebrew.
 */
export const iso = (value: string | number) => `⁨${value}⁩`;
