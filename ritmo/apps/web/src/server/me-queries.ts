import 'server-only';
import { addDays, shiftMinutes, weekPayMinor, weekStart, weekTotals, workedMinutes, type WeekTotals } from '@ritmo/core';
import type { Tx } from '@ritmo/db';
import type { Ctx } from './context';
import { todayLocal } from '@/lib/format';
import { toEntry, type EntryRow } from './queries';

export interface MyShift {
  id: string;
  location_id: string;
  location_name: string;
  position_name: string | null;
  position_color: 'green' | 'sun' | 'sky' | 'clay' | 'stone' | null;
  starts_at: Date;
  ends_at: Date;
  break_minutes: number;
}

export interface OpenEntry extends EntryRow {
  location_name: string | null;
}

export interface ClockIn {
  inside_geofence: boolean | null;
  accuracy_m: number | null;
  distance_m: number | null;
}

export interface TodayData {
  shift: MyShift | null;
  open: OpenEntry | null;
  lastClockIn: ClockIn | null;
  /** Seconds worked today in entries that are already closed. */
  closedSecondsToday: number;
  week: WeekTotals;
  scheduledMinutes: number;
  rateMinor: number;
  estPayMinor: number;
  next: MyShift | null;
  swapBanner: { name: string; day: Date } | null;
}

const shiftCols = (tx: Tx) => tx`
  s.id, s.location_id, l.name as location_name, p.name as position_name, p.color as position_color,
  s.starts_at, s.ends_at, s.break_minutes`;

async function myWeekEntries(tx: Tx, ctx: Ctx, from: string) {
  return tx<EntryRow[]>`
    select id, member_id, location_id, shift_id, work_date::text as work_date, started_at, ended_at,
           break_minutes, break_started_at, edited_reason
    from ritmo.time_entries
    where member_id = ${ctx.member.memberId} and work_date >= ${from} and work_date < ${addDays(from, 7)}
    order by started_at`;
}

export async function todayData(ctx: Ctx): Promise<TodayData> {
  const me = ctx.member.memberId;
  const today = todayLocal(ctx.member.timezone);
  const ws = weekStart(today);
  const now = new Date();

  return ctx.db(async (tx) => {
    const [shiftsToday, openRows, clockIns, entries, weekShifts, pay, nextRows, swaps] = await Promise.all([
      tx<MyShift[]>`
        select ${shiftCols(tx)}
        from ritmo.shifts s
        join ritmo.locations l on l.id = s.location_id
        left join ritmo.positions p on p.id = s.position_id
        where s.member_id = ${me} and s.status = 'published'
          and (s.starts_at at time zone ${ctx.member.timezone})::date = ${today}
        order by s.starts_at`,
      tx<OpenEntry[]>`
        select te.id, te.member_id, te.location_id, te.shift_id, te.work_date::text as work_date, te.started_at,
               te.ended_at, te.break_minutes, te.break_started_at, te.edited_reason, l.name as location_name
        from ritmo.time_entries te left join ritmo.locations l on l.id = te.location_id
        where te.member_id = ${me} and te.ended_at is null`,
      tx<ClockIn[]>`
        select inside_geofence, accuracy_m, distance_m from ritmo.time_events
        where member_id = ${me} and type = 'clock_in' order by occurred_at desc limit 1`,
      myWeekEntries(tx, ctx, ws),
      tx<{ starts_at: Date; ends_at: Date; break_minutes: number }[]>`
        select starts_at, ends_at, break_minutes from ritmo.shifts
        where member_id = ${me} and status = 'published'
          and starts_at >= ${ws}::date and starts_at < ${addDays(ws, 7)}::date`,
      tx<{ hourly_rate_minor: bigint }[]>`select hourly_rate_minor from ritmo.member_pay where member_id = ${me}`,
      tx<MyShift[]>`
        select ${shiftCols(tx)}
        from ritmo.shifts s
        join ritmo.locations l on l.id = s.location_id
        left join ritmo.positions p on p.id = s.position_id
        where s.member_id = ${me} and s.status = 'published' and s.starts_at > now()
        order by s.starts_at limit 2`,
      tx<{ first_name: string; starts_at: Date }[]>`
        select m.first_name, s.starts_at
        from ritmo.shift_requests r
        join ritmo.shifts s on s.id = r.shift_id
        join ritmo.members m on m.id = r.target_member_id
        where r.requester_member_id = ${me} and r.kind = 'swap' and r.status = 'pending' and s.starts_at > now()
        order by s.starts_at limit 1`,
    ]);

    const open = openRows[0] ?? null;
    // The shift to show: the one being worked, else the next one today that hasn't ended.
    const shift =
      (open && shiftsToday.find((s) => s.id === open.shift_id)) ??
      shiftsToday.find((s) => s.ends_at > now) ??
      shiftsToday[0] ??
      null;
    const closedSecondsToday = entries
      .filter((e) => e.ended_at && e.work_date === today)
      .reduce((sum, e) => sum + workedMinutes(toEntry(e)) * 60, 0);
    const week = weekTotals(entries.map(toEntry), ctx.member.policy, ctx.member.timezone, now);
    const rateMinor = Number(pay[0]?.hourly_rate_minor ?? 0);
    const next = nextRows.find((s) => s.id !== shift?.id) ?? null;

    return {
      shift,
      open,
      lastClockIn: open ? (clockIns[0] ?? null) : null,
      closedSecondsToday,
      week,
      scheduledMinutes: weekShifts.reduce((m, s) => m + shiftMinutes({ startsAt: s.starts_at, endsAt: s.ends_at, breakMinutes: s.break_minutes }), 0),
      rateMinor,
      estPayMinor: weekPayMinor(week, rateMinor, ctx.member.policy),
      next,
      swapBanner: swaps[0] ? { name: swaps[0].first_name, day: swaps[0].starts_at } : null,
    };
  });
}

export interface WeekShift extends MyShift {
  teammates: string[];
  request: { id: string; kind: 'swap' | 'drop'; target: string | null } | null;
}

export interface OpenShift {
  id: string;
  location_name: string;
  position_name: string | null;
  starts_at: Date;
  ends_at: Date;
  open_bonus_minor: bigint | null;
  spots: number;
  claimed: string | null;
}

export interface Colleague {
  id: string;
  first_name: string;
  last_name: string;
}

export async function shiftsData(ctx: Ctx, ws: string) {
  const me = ctx.member.memberId;
  const tz = ctx.member.timezone;
  return ctx.db(async (tx) => {
    const [mine, openRows, colleagues] = await Promise.all([
      tx<(MyShift & { teammates: string[] | null; req_id: string | null; req_kind: 'swap' | 'drop' | null; req_target: string | null })[]>`
        select ${shiftCols(tx)},
          (select array_agg(m.first_name order by o.starts_at)
             from ritmo.shifts o join ritmo.members m on m.id = o.member_id
            where o.location_id = s.location_id and o.status = 'published' and o.id <> s.id
              and o.starts_at < s.ends_at and o.ends_at > s.starts_at) as teammates,
          r.id as req_id, r.kind as req_kind, t.first_name as req_target
        from ritmo.shifts s
        join ritmo.locations l on l.id = s.location_id
        left join ritmo.positions p on p.id = s.position_id
        left join ritmo.shift_requests r on r.shift_id = s.id and r.requester_member_id = ${me} and r.status = 'pending'
        left join ritmo.members t on t.id = r.target_member_id
        where s.member_id = ${me} and s.status = 'published'
          and (s.starts_at at time zone ${tz})::date >= ${ws} and (s.starts_at at time zone ${tz})::date < ${addDays(ws, 7)}
        order by s.starts_at`,
      // Open shifts at my locations, for my position (or any position), grouped into "spots".
      tx<OpenShift[]>`
        select (array_agg(s.id order by s.id))[1] as id, l.name as location_name, p.name as position_name,
               s.starts_at, s.ends_at, max(s.open_bonus_minor) as open_bonus_minor, count(*)::int as spots,
               (array_agg(r.id) filter (where r.id is not null))[1] as claimed
        from ritmo.shifts s
        join ritmo.locations l on l.id = s.location_id
        left join ritmo.positions p on p.id = s.position_id
        left join ritmo.shift_requests r on r.shift_id = s.id and r.requester_member_id = ${me} and r.status = 'pending'
        where s.member_id is null and s.status = 'published' and s.starts_at > now()
          and s.location_id in (select location_id from ritmo.member_locations where member_id = ${me})
          and (s.position_id is null or s.position_id = (select position_id from ritmo.members where id = ${me})
               or (select position_id from ritmo.members where id = ${me}) is null)
        group by l.name, p.name, s.starts_at, s.ends_at, s.location_id, s.position_id
        order by s.starts_at limit 12`,
      tx<Colleague[]>`
        select distinct m.id, m.first_name, m.last_name
        from ritmo.members m
        join ritmo.member_locations ml on ml.member_id = m.id
        where ml.location_id in (select location_id from ritmo.member_locations where member_id = ${me})
          and m.id <> ${me} and m.status = 'active'
        order by m.first_name, m.last_name`,
    ]);
    const shifts: WeekShift[] = mine.map((s) => ({
      ...s,
      teammates: s.teammates ?? [],
      request: s.req_id && s.req_kind ? { id: s.req_id, kind: s.req_kind, target: s.req_target } : null,
    }));
    return { shifts, open: openRows, colleagues };
  });
}

export interface AppTime {
  app: string;
  minutes: number;
}

export async function collectedData(ctx: Ctx) {
  const me = ctx.member.memberId;
  const tz = ctx.member.timezone;
  const today = todayLocal(tz);
  const ws = weekStart(today);
  return ctx.db(async (tx) => {
    const [segments, entries] = await Promise.all([
      tx<{ kind: 'focus' | 'neutral' | 'idle' | 'break'; app: string | null; started_at: Date; ended_at: Date }[]>`
        select kind, app, started_at, ended_at from ritmo.activity_segments
        where member_id = ${me} and (started_at at time zone ${tz})::date = ${today}
        order by started_at`,
      myWeekEntries(tx, ctx, ws),
    ]);
    const byApp = new Map<string, number>();
    let active = 0;
    let idle = 0;
    for (const s of segments) {
      const min = Math.round((s.ended_at.getTime() - s.started_at.getTime()) / 60000);
      if (s.kind === 'idle') idle += min;
      if (s.kind === 'focus' || s.kind === 'neutral') {
        active += min;
        if (s.app) byApp.set(s.app, (byApp.get(s.app) ?? 0) + min);
      }
    }
    const apps: AppTime[] = [...byApp.entries()].map(([app, minutes]) => ({ app, minutes })).sort((a, b) => b.minutes - a.minutes).slice(0, 8);
    return { segments, apps, active, idle, week: weekTotals(entries.map(toEntry), ctx.member.policy, tz) };
  });
}
