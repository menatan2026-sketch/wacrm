import { describe, expect, it } from 'vitest';
import {
  IL_STANDARD,
  addDays,
  checkGeofence,
  csvCell,
  findConflicts,
  formatDuration,
  formatMoney,
  formatTimer,
  lateMinutes,
  localDate,
  localTime,
  matchShift,
  payrollCsv,
  resolvePolicy,
  weekPayMinor,
  weekStart,
  weekTotals,
  workedMinutes,
  zonedToUtc,
} from './index';

const tz = 'Asia/Jerusalem';
const at = (date: string, time: string) => zonedToUtc(date, time, tz);
const entry = (date: string, from: string, to: string, breakMinutes = 0) => ({
  startedAt: at(date, from),
  endedAt: at(date, to),
  breakMinutes,
});

describe('time zones', () => {
  it('converts Israeli wall-clock time to UTC across DST', () => {
    // Winter (IST, UTC+2) and summer (IDT, UTC+3)
    expect(zonedToUtc('2026-01-15', '08:00', tz).toISOString()).toBe('2026-01-15T06:00:00.000Z');
    expect(zonedToUtc('2026-07-15', '08:00', tz).toISOString()).toBe('2026-07-15T05:00:00.000Z');
  });

  it('round-trips local date and time', () => {
    const d = zonedToUtc('2026-10-14', '23:30', tz);
    expect(localDate(d, tz)).toBe('2026-10-14');
    expect(localTime(d, tz)).toBe('23:30');
  });

  it('starts the week on Sunday', () => {
    expect(weekStart('2026-10-14')).toBe('2026-10-11'); // Wednesday -> Sunday
    expect(weekStart('2026-10-11')).toBe('2026-10-11');
    expect(weekStart('2026-10-17')).toBe('2026-10-11'); // Saturday
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('formats durations and timers', () => {
    expect(formatDuration(465)).toBe('7:45');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatTimer(13337)).toBe('03:42:17');
  });
});

describe('worked minutes', () => {
  it('subtracts breaks, including a break still running', () => {
    const now = at('2026-10-14', '12:00');
    expect(workedMinutes(entry('2026-10-14', '08:00', '16:30', 30))).toBe(480);
    expect(
      workedMinutes({ startedAt: at('2026-10-14', '08:00'), endedAt: null, breakMinutes: 15, breakStartedAt: at('2026-10-14', '11:30') }, now),
    ).toBe(240 - 15 - 30);
  });
});

describe('Israeli overtime (il_standard preset)', () => {
  const p = IL_STANDARD;

  it('keeps a normal day regular', () => {
    const t = weekTotals([entry('2026-10-12', '08:00', '16:24')], p, tz);
    expect(t).toMatchObject({ regular: 504, overtime1: 0, overtime2: 0, restDay: 0, total: 504 });
  });

  it('pays the first two overtime hours at tier 1 and the rest at tier 2', () => {
    const t = weekTotals([entry('2026-10-12', '07:00', '19:24')], p, tz); // 12:24 = 744 min
    expect(t.regular).toBe(504);
    expect(t.overtime1).toBe(120);
    expect(t.overtime2).toBe(120);
  });

  it('moves weekly regular time beyond 42 hours to tier 1', () => {
    // Six days of 8:24 = 50:24, none of it daily overtime; Saturday excluded
    const days = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
    const t = weekTotals(days.map((d) => entry(d, '08:00', '16:24')), p, tz);
    expect(t.regular).toBe(42 * 60);
    expect(t.overtime1).toBe(6 * 504 - 42 * 60);
    expect(t.total).toBe(6 * 504);
  });

  it('counts Saturday work as rest-day time', () => {
    const t = weekTotals([entry('2026-10-17', '09:00', '15:00')], p, tz);
    expect(t).toMatchObject({ restDay: 360, regular: 0 });
  });

  it('prices a week with the policy rates', () => {
    const t = weekTotals([entry('2026-10-12', '07:00', '19:24')], p, tz);
    // 504 + 120*1.25 + 120*1.5 = 834 paid minutes at ₪60/h
    expect(weekPayMinor(t, 6000, p)).toBe(834 * 100);
  });

  it('returns zeros for a week with no entries', () => {
    expect(weekTotals([], p, tz)).toEqual({ total: 0, regular: 0, overtime1: 0, overtime2: 0, restDay: 0, byDate: {} });
  });

  it('falls back to the preset for empty or invalid stored policies', () => {
    expect(resolvePolicy({})).toEqual(IL_STANDARD);
    expect(resolvePolicy({ dailyRegularMinutes: -5 })).toEqual(IL_STANDARD);
    expect(resolvePolicy({ geofenceMode: 'block' }).geofenceMode).toBe('block');
  });
});

describe('geofence', () => {
  const dizengoff = { lat: 32.0809, lng: 34.7745, radius: 150 };

  it('accepts a position inside the radius', () => {
    expect(checkGeofence({ lat: 32.0812, lng: 34.7748, accuracy: 10 }, dizengoff).inside).toBe(true);
  });

  it('flags a position 320 m away', () => {
    const r = checkGeofence({ lat: 32.0838, lng: 34.7745, accuracy: 8 }, dizengoff);
    expect(r.inside).toBe(false);
    expect(r.distance).toBeGreaterThan(300);
  });

  it('caps the accuracy slack so a vague fix cannot pass from far away', () => {
    expect(checkGeofence({ lat: 32.1, lng: 34.7745, accuracy: 5000 }, dizengoff).inside).toBe(false);
  });

  it('returns unknown without a position or fence', () => {
    expect(checkGeofence(null, dizengoff)).toEqual({ inside: null, distance: null });
  });
});

describe('scheduling', () => {
  const shift = (id: string, date: string, from: string, to: string, memberId = 'dana') => ({
    id,
    memberId,
    startsAt: at(date, from),
    endsAt: at(date, to),
    breakMinutes: 0,
  });

  it('finds overlaps and short rest', () => {
    const others = [shift('a', '2026-10-12', '07:00', '15:00'), shift('b', '2026-10-13', '23:00', '23:30')];
    expect(findConflicts(shift('c', '2026-10-12', '14:00', '20:00'), others, IL_STANDARD).map((c) => c.kind)).toContain('overlap');
    const late = findConflicts(shift('d', '2026-10-12', '19:00', '23:00'), others, IL_STANDARD);
    expect(late).toEqual([{ kind: 'short_rest', shiftId: 'd', otherShiftId: 'a', restMinutes: 240 }]);
  });

  it('finds nothing when the person has no other shifts', () => {
    expect(findConflicts(shift('c', '2026-10-12', '08:00', '12:00'), [], IL_STANDARD)).toEqual([]);
  });

  it('accepts rest exactly at the policy minimum', () => {
    const others = [shift('a', '2026-10-12', '07:00', '15:00')];
    expect(findConflicts(shift('d', '2026-10-12', '23:00', '23:30'), others, IL_STANDARD)).toEqual([]);
  });

  it('ignores open shifts and other people', () => {
    const others = [shift('a', '2026-10-12', '07:00', '15:00', 'omer')];
    expect(findConflicts(shift('c', '2026-10-12', '08:00', '12:00'), others, IL_STANDARD)).toEqual([]);
    expect(findConflicts({ ...shift('c', '2026-10-12', '08:00', '12:00'), memberId: null }, others, IL_STANDARD)).toEqual([]);
  });

  it('computes lateness after the grace period', () => {
    expect(lateMinutes(at('2026-10-14', '08:00'), at('2026-10-14', '08:04'), IL_STANDARD)).toBe(0);
    expect(lateMinutes(at('2026-10-14', '08:00'), at('2026-10-14', '08:05'), IL_STANDARD)).toBe(0); // exactly at the grace limit
    expect(lateMinutes(at('2026-10-14', '08:00'), at('2026-10-14', '08:06'), IL_STANDARD)).toBe(6);
    expect(lateMinutes(at('2026-10-14', '08:00'), at('2026-10-14', '07:50'), IL_STANDARD)).toBe(0); // early
    expect(lateMinutes(at('2026-10-14', '08:00'), at('2026-10-14', '08:14'), IL_STANDARD)).toBe(14);
  });

  it('matches a clock-in to the nearest shift', () => {
    const shifts = [shift('m', '2026-10-14', '07:00', '15:00'), shift('e', '2026-10-14', '15:00', '23:00')];
    expect(matchShift(at('2026-10-14', '06:55'), shifts)?.id).toBe('m');
    expect(matchShift(at('2026-10-14', '14:50'), shifts)?.id).toBe('e');
    expect(matchShift(at('2026-10-14', '03:00'), shifts)).toBeNull();
    expect(matchShift(at('2026-10-14', '07:00'), [])).toBeNull();
  });
});

describe('payroll export', () => {
  const headers = {
    employeeNo: 'מס׳ עובד', name: 'שם', location: 'סניף', regular: 'רגילות', overtime1: '125%', overtime2: '150%',
    restDay: 'מנוחה', total: 'סה״כ', approved: 'מאושר', yes: 'כן', no: 'לא',
  };

  it('writes decimal hours with a BOM and CRLF', () => {
    const csv = payrollCsv(
      [{ employeeNo: '1001', name: 'דנה לוי', location: 'דיזנגוף', approved: true,
         totals: { regular: 2520, overtime1: 90, overtime2: 0, restDay: 0, total: 2610 } }],
      headers,
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('1001,דנה לוי,דיזנגוף,42.00,1.50,0.00,0.00,43.50,כן\r\n');
  });

  it('neutralises formula injection and quotes commas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('Cohen, Dana')).toBe('"Cohen, Dana"');
  });
});

describe('formatting', () => {
  it('formats shekels without bidi marks', () => {
    expect(formatMoney(3842000)).toMatch(/38,420/);
    expect(formatMoney(3842000)).not.toMatch(/[‎‏]/);
  });
});
