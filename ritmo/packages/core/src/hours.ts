import type { AttendancePolicy } from './policy';
import { localDate, minutesBetween, weekdayOf, DEFAULT_TZ } from './time';

export interface EntryLike {
  startedAt: Date;
  endedAt: Date | null;
  breakMinutes: number;
  /** When a break is running right now. */
  breakStartedAt?: Date | null;
  workDate?: string;
}

/** Paid minutes of one entry. Open entries count up to `now`. */
export function workedMinutes(entry: EntryLike, now = new Date()): number {
  const end = entry.endedAt ?? now;
  const runningBreak = !entry.endedAt && entry.breakStartedAt ? minutesBetween(entry.breakStartedAt, now) : 0;
  return Math.max(0, minutesBetween(entry.startedAt, end) - entry.breakMinutes - runningBreak);
}

export interface WeekTotals {
  /** All worked minutes. */
  total: number;
  regular: number;
  /** Overtime at the first tier (125% by default). */
  overtime1: number;
  /** Overtime at the second tier (150% by default). */
  overtime2: number;
  /** Minutes worked on the weekly rest day. */
  restDay: number;
  /** Minutes per local date. */
  byDate: Record<string, number>;
}

/**
 * Splits a week of entries into regular time, two overtime tiers and rest-day
 * time, following the policy:
 *   1. Per day: up to `dailyRegularMinutes` is regular; the next
 *      `firstTierMinutes` are tier 1; anything beyond is tier 2.
 *   2. All rest-day minutes are paid at the rest-day rate instead.
 *   3. Per week: regular minutes beyond `weeklyRegularMinutes` move to tier 1.
 */
export function weekTotals(
  entries: EntryLike[],
  policy: AttendancePolicy,
  tz = DEFAULT_TZ,
  now = new Date(),
): WeekTotals {
  const byDate: Record<string, number> = {};
  for (const e of entries) {
    const date = e.workDate ?? localDate(e.startedAt, tz);
    byDate[date] = (byDate[date] ?? 0) + workedMinutes(e, now);
  }

  let regular = 0;
  let overtime1 = 0;
  let overtime2 = 0;
  let restDay = 0;
  for (const [date, minutes] of Object.entries(byDate)) {
    if (weekdayOf(date) === policy.restDay) {
      restDay += minutes;
      continue;
    }
    const reg = Math.min(minutes, policy.dailyRegularMinutes);
    const ot = minutes - reg;
    regular += reg;
    overtime1 += Math.min(ot, policy.firstTierMinutes);
    overtime2 += Math.max(0, ot - policy.firstTierMinutes);
  }

  if (regular > policy.weeklyRegularMinutes) {
    overtime1 += regular - policy.weeklyRegularMinutes;
    regular = policy.weeklyRegularMinutes;
  }

  return { total: regular + overtime1 + overtime2 + restDay, regular, overtime1, overtime2, restDay, byDate };
}

/** Gross pay in minor units (agorot) for a week, given an hourly rate. */
export function weekPayMinor(totals: WeekTotals, hourlyRateMinor: number, policy: AttendancePolicy): number {
  const perMinute = hourlyRateMinor / 60;
  return Math.round(
    perMinute *
      (totals.regular +
        totals.overtime1 * policy.firstTierRate +
        totals.overtime2 * policy.secondTierRate +
        totals.restDay * policy.restDayRate),
  );
}
