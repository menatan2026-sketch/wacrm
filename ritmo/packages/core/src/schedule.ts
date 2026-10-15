import type { AttendancePolicy } from './policy';
import { minutesBetween, MINUTE } from './time';

export interface ShiftLike {
  id?: string;
  memberId: string | null;
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
}

export function shiftMinutes(s: Pick<ShiftLike, 'startsAt' | 'endsAt' | 'breakMinutes'>): number {
  return Math.max(0, minutesBetween(s.startsAt, s.endsAt) - s.breakMinutes);
}

/** Planned labour cost of a shift in minor units. */
export function shiftCostMinor(s: Pick<ShiftLike, 'startsAt' | 'endsAt' | 'breakMinutes'>, hourlyRateMinor: number): number {
  return Math.round((shiftMinutes(s) / 60) * hourlyRateMinor);
}

export type ConflictKind = 'overlap' | 'short_rest';

export interface Conflict {
  kind: ConflictKind;
  shiftId?: string;
  otherShiftId?: string;
  /** For short_rest: minutes of rest between the two shifts. */
  restMinutes?: number;
}

/**
 * Checks a candidate shift against the person's other shifts: overlaps
 * (also enforced by the database) and rest shorter than the policy minimum.
 */
export function findConflicts(candidate: ShiftLike, others: ShiftLike[], policy: AttendancePolicy): Conflict[] {
  if (!candidate.memberId) return [];
  const out: Conflict[] = [];
  for (const o of others) {
    if (o.memberId !== candidate.memberId || (candidate.id && o.id === candidate.id)) continue;
    const overlaps = candidate.startsAt < o.endsAt && o.startsAt < candidate.endsAt;
    if (overlaps) {
      out.push({ kind: 'overlap', shiftId: candidate.id, otherShiftId: o.id });
      continue;
    }
    const gap =
      candidate.startsAt >= o.endsAt
        ? (candidate.startsAt.getTime() - o.endsAt.getTime()) / MINUTE
        : (o.startsAt.getTime() - candidate.endsAt.getTime()) / MINUTE;
    if (gap < policy.minRestBetweenShiftsMinutes) {
      out.push({ kind: 'short_rest', shiftId: candidate.id, otherShiftId: o.id, restMinutes: Math.round(gap) });
    }
  }
  return out;
}

/** Minutes late, or 0. */
export function lateMinutes(scheduledStart: Date, clockIn: Date, policy: AttendancePolicy): number {
  const late = minutesBetween(scheduledStart, clockIn);
  return late > policy.lateGraceMinutes ? late : 0;
}

/** Picks the shift a clock-in most plausibly belongs to (starts within ±3h). */
export function matchShift<T extends Pick<ShiftLike, 'startsAt' | 'endsAt'>>(clockIn: Date, shifts: T[]): T | null {
  let best: T | null = null;
  let bestGap = Infinity;
  for (const s of shifts) {
    const gap = Math.abs(s.startsAt.getTime() - clockIn.getTime());
    if (gap <= 3 * 60 * MINUTE && gap < bestGap && clockIn < s.endsAt) {
      best = s;
      bestGap = gap;
    }
  }
  return best;
}
