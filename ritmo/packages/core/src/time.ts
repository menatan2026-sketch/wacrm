// Time-zone aware helpers built on Intl, so the same code runs on the
// server, in the browser and (later) on React Native without a date library.
// Every instant is a UTC Date; "local" means the location's IANA zone.

export const DEFAULT_TZ = 'Asia/Jerusalem';
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, tz = DEFAULT_TZ): ZonedParts {
  const out: Partial<ZonedParts> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) {
    if (p.type === 'weekday') out.weekday = WEEKDAYS[p.value];
    else if (p.type !== 'literal' && p.type !== 'dayPeriod') {
      (out as Record<string, number>)[p.type] = Number(p.value);
    }
  }
  return out as ZonedParts;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function localDate(date: Date, tz = DEFAULT_TZ): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Local wall-clock time as HH:MM (24h). */
export function localTime(date: Date, tz = DEFAULT_TZ): string {
  const p = zonedParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Offset of `tz` from UTC at instant `date`, in milliseconds. */
export function tzOffset(date: Date, tz = DEFAULT_TZ): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The UTC instant for a local date + wall-clock time in `tz`.
 * Handles DST: for a time that doesn't exist (spring forward) the result
 * lands just after the gap; for an ambiguous time, the first occurrence.
 */
export function zonedToUtc(dateStr: string, timeStr: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const [hh, mm] = timeStr.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffset(new Date(guess), tz);
  const second = guess - tzOffset(new Date(first), tz);
  return new Date(Math.min(first, second));
}

/** Adds whole days to a YYYY-MM-DD string. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Day of week (0 = Sunday) of a YYYY-MM-DD string. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Start of the Israeli work week (Sunday) containing `dateStr`. */
export function weekStart(dateStr: string, weekStartsOn = 0): string {
  const wd = weekdayOf(dateStr);
  return addDays(dateStr, -((wd - weekStartsOn + 7) % 7));
}

/** The seven local dates of the week starting at `start`. */
export function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** ISO-ish week number for labels ("Week 42"). Uses the Thursday rule. */
export function weekNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / DAY + 1) / 7);
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / MINUTE));
}

/** 465 → "7:45". Used for durations in tables (always LTR-isolated in UI). */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const m = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(m / 60)}:${pad(m % 60)}`;
}

/** Seconds → "03:42:17" for the live timer. */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
