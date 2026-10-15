import { z } from 'zod';

// Attendance policy, stored per organization as JSON and validated here.
// The Israeli preset encodes common defaults for a 42-hour, 5-day week.
// It is a starting point that each customer's labor counsel must confirm;
// nothing in the calculation code hard-codes these numbers.

export const attendancePolicySchema = z.object({
  preset: z.enum(['il_standard', 'custom']).default('il_standard'),
  /** Regular minutes per day before daily overtime starts. */
  dailyRegularMinutes: z.number().int().min(60).max(24 * 60).default(504),
  /** Regular minutes per week before weekly overtime starts. */
  weeklyRegularMinutes: z.number().int().min(60).max(7 * 24 * 60).default(42 * 60),
  /** Overtime minutes per day paid at the first tier before the second tier starts. */
  firstTierMinutes: z.number().int().min(0).max(12 * 60).default(120),
  firstTierRate: z.number().min(1).max(3).default(1.25),
  secondTierRate: z.number().min(1).max(3).default(1.5),
  /** Weekly rest day (0 = Sunday … 6 = Saturday). */
  restDay: z.number().int().min(0).max(6).default(6),
  restDayRate: z.number().min(1).max(3).default(1.5),
  /** Minutes after the scheduled start before a clock-in counts as late. */
  lateGraceMinutes: z.number().int().min(0).max(60).default(5),
  /** A shift this long without a break is flagged. */
  breakRequiredAfterMinutes: z.number().int().min(60).max(12 * 60).default(6 * 60),
  minBreakMinutes: z.number().int().min(0).max(120).default(30),
  /** Open entries are flagged after this long. */
  longShiftMinutes: z.number().int().min(60).max(24 * 60).default(12 * 60),
  /** Minimum rest between two shifts for the same person. */
  minRestBetweenShiftsMinutes: z.number().int().min(0).max(24 * 60).default(8 * 60),
  /** Clock-ins outside the geofence: just flag them, or refuse. */
  geofenceMode: z.enum(['off', 'flag', 'block']).default('flag'),
});

export type AttendancePolicy = z.infer<typeof attendancePolicySchema>;

/** Parses whatever is stored (possibly `{}` or partial) into a full policy. */
export function resolvePolicy(raw: unknown): AttendancePolicy {
  const parsed = attendancePolicySchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : attendancePolicySchema.parse({});
}

export const IL_STANDARD: AttendancePolicy = attendancePolicySchema.parse({});
