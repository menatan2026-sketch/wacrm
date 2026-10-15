import 'server-only';
import { addDays, weekPayMinor, weekStart, weekTotals, workedMinutes, type EntryLike, type WeekTotals } from '@ritmo/core';
import type { Tx } from '@ritmo/db';
import type { Ctx } from './context';
import { TZ, todayLocal } from '@/lib/format';

export interface LocationRow {
  id: string;
  name: string;
  kind: 'branch' | 'office';
  lat: number | null;
  lng: number | null;
  geofence_radius_m: number;
  weekly_budget_minor: bigint | null;
}

export async function locations(ctx: Ctx): Promise<LocationRow[]> {
  return ctx.db((tx) => tx<LocationRow[]>`
    select id, name, kind, lat, lng, geofence_radius_m, weekly_budget_minor
    from ritmo.locations where org_id = ${ctx.member.orgId} order by sort_order, name`);
}

export interface EntryRow {
  id: string;
  member_id: string;
  location_id: string | null;
  shift_id: string | null;
  work_date: string;
  started_at: Date;
  ended_at: Date | null;
  break_minutes: number;
  break_started_at: Date | null;
  edited_reason: string | null;
}

export async function entriesBetween(tx: Tx, orgId: string, from: string, to: string, locationId?: string | null) {
  return tx<EntryRow[]>`
    select te.id, te.member_id, te.location_id, te.shift_id, te.work_date::text as work_date, te.started_at, te.ended_at,
           te.break_minutes, te.break_started_at, te.edited_reason
    from ritmo.time_entries te
    where te.org_id = ${orgId} and te.work_date >= ${from} and te.work_date < ${to}
      ${locationId ? tx`and te.location_id = ${locationId}` : tx``}
    order by te.started_at`;
}

export const toEntry = (e: EntryRow): EntryLike => ({
  startedAt: e.started_at,
  endedAt: e.ended_at,
  breakMinutes: e.break_minutes,
  breakStartedAt: e.break_started_at,
  workDate: e.work_date,
});

/** Groups entries by member and computes week totals with the org policy. */
export function totalsByMember(ctx: Ctx, entries: EntryRow[], now = new Date()) {
  const by = new Map<string, EntryRow[]>();
  for (const e of entries) {
    const list = by.get(e.member_id) ?? [];
    list.push(e);
    by.set(e.member_id, list);
  }
  const out = new Map<string, WeekTotals>();
  for (const [member, list] of by) out.set(member, weekTotals(list.map(toEntry), ctx.member.policy, TZ, now));
  return out;
}

export interface OverviewData {
  onShift: Array<{
    entryId: string; memberId: string; firstName: string; lastName: string; avatarColor: string; position: string | null;
    location: string | null; startedAt: Date; breakStartedAt: Date | null; shiftStart: Date | null; source: string | null;
    workedMinutes: number;
  }>;
  notInYet: number;
  dailyPeople: number[];
  hoursWeek: number;
  hoursLastWeekSamePoint: number;
  dailyHours: number[];
  overtimeWeek: number;
  overtimeLastWeek: number;
  overtimeTopLocation: string | null;
  dailyOvertime: number[];
  payrollMinor: number;
  budgetMinor: number;
  requests: Array<{
    id: string; kind: 'swap' | 'claim' | 'drop'; requester: string; target: string | null; startsAt: Date; endsAt: Date;
    location: string; note: string | null;
  }>;
  geofence: Array<{ id: string; name: string; at: Date; distance: number; location: string }>;
  pendingTimesheets: { count: number; withIssues: number; weekStart: string };
  activity: Array<{
    memberId: string; name: string;
    segments: Array<{ kind: 'focus' | 'neutral' | 'idle' | 'break'; minutes: number }>;
    activeMinutes: number; live: boolean;
  }>;
}

export async function overview(ctx: Ctx, locationId: string | null): Promise<OverviewData> {
  const orgId = ctx.member.orgId;
  const today = todayLocal();
  const ws = weekStart(today);
  const now = new Date();

  return ctx.db(async (tx) => {
    const locFilter = (alias: string) => (locationId ? tx`and ${tx(alias)}.location_id = ${locationId}` : tx``);

    const onShift = await tx<
      {
        entry_id: string; member_id: string; first_name: string; last_name: string; avatar_color: string; position: string | null;
        location: string | null; started_at: Date; break_started_at: Date | null; break_minutes: number; shift_start: Date | null;
        source: string | null;
      }[]
    >`
      select te.id as entry_id, te.member_id, m.first_name, m.last_name, m.avatar_color, coalesce(m.title, p.name) as position,
             l.name as location, te.started_at, te.break_started_at, te.break_minutes, sh.starts_at as shift_start,
             (select ev.source from ritmo.time_events ev where ev.member_id = te.member_id and ev.type = 'clock_in'
              order by ev.occurred_at desc limit 1) as source
      from ritmo.time_entries te
      join ritmo.members m on m.id = te.member_id
      left join ritmo.positions p on p.id = m.position_id
      left join ritmo.locations l on l.id = te.location_id
      left join ritmo.shifts sh on sh.id = te.shift_id
      where te.org_id = ${orgId} and te.ended_at is null ${locFilter('te')}
      order by te.started_at`;

    const [notIn] = await tx<{ n: number }[]>`
      select count(*)::int as n from ritmo.shifts sh
      where sh.org_id = ${orgId} and sh.status = 'published' and sh.member_id is not null
        and sh.starts_at <= now() and sh.ends_at > now() ${locFilter('sh')}
        and not exists (select 1 from ritmo.time_entries te where te.member_id = sh.member_id and te.started_at >= sh.starts_at - interval '3 hours'
                        and te.started_at < sh.ends_at)`;

    const entries = await entriesBetween(tx, orgId, addDays(ws, -7), addDays(ws, 7), locationId);
    const thisWeek = entries.filter((e) => e.work_date >= ws);
    const lastWeek = entries.filter((e) => e.work_date < ws);

    // Same point last week: only what had happened by now minus 7 days.
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const lastWeekToPoint = lastWeek
      .filter((e) => e.started_at <= weekAgo)
      .map((e) => (e.ended_at && e.ended_at > weekAgo ? { ...e, ended_at: weekAgo } : e));

    const sumWorked = (list: EntryRow[], at = now) => list.reduce((s, e) => s + workedMinutes(toEntry(e), at), 0);

    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const dailyHours = days.map((d) => Math.round(sumWorked(entries.filter((e) => e.work_date === d)) / 60));
    const dailyPeople = days.map((d) => new Set(entries.filter((e) => e.work_date === d).map((e) => e.member_id)).size);

    const thisTotals = totalsByMember(ctx, thisWeek, now);
    const lastTotals = totalsByMember(ctx, lastWeekToPoint, weekAgo);
    const ot = (m: Map<string, WeekTotals>) => [...m.values()].reduce((s, t) => s + t.overtime1 + t.overtime2, 0);

    // Daily overtime (approximate: minutes beyond the daily regular limit)
    const dailyOvertime = days.map((d) => {
      const perMember = new Map<string, number>();
      for (const e of entries.filter((x) => x.work_date === d)) {
        perMember.set(e.member_id, (perMember.get(e.member_id) ?? 0) + workedMinutes(toEntry(e), now));
      }
      return [...perMember.values()].reduce((s, m) => s + Math.max(0, m - ctx.member.policy.dailyRegularMinutes), 0);
    });

    // Branch with the most people in overtime this week
    const otLocRows = await tx<{ name: string; ot_members: number }[]>`
      select l.name, count(*)::int as ot_members from ritmo.locations l
      join ritmo.members m on m.primary_location_id = l.id
      where l.org_id = ${orgId} and m.id = any(${[...thisTotals.entries()].filter(([, t]) => t.overtime1 + t.overtime2 > 0).map(([id]) => id)}::uuid[])
      group by l.name order by 2 desc limit 1`;

    // Payroll: worked time priced with each person's rate (RLS hides rates you can't see)
    const pay = await tx<{ member_id: string; hourly_rate_minor: bigint }[]>`
      select member_id, hourly_rate_minor from ritmo.member_pay where org_id = ${orgId}`;
    const rate = new Map(pay.map((p) => [p.member_id, Number(p.hourly_rate_minor)]));
    let payrollMinor = 0;
    for (const [memberId, t] of thisTotals) payrollMinor += weekPayMinor(t, rate.get(memberId) ?? 0, ctx.member.policy);

    const [budget] = await tx<{ total: bigint | null }[]>`
      select sum(weekly_budget_minor) as total from ritmo.locations where org_id = ${orgId}
      ${locationId ? tx`and id = ${locationId}` : tx``}`;

    const requests = await tx<
      { id: string; kind: 'swap' | 'claim' | 'drop'; requester: string; target: string | null; starts_at: Date; ends_at: Date; location: string; note: string | null }[]
    >`
      select r.id, r.kind, rq.first_name as requester, tg.first_name as target, s.starts_at, s.ends_at, l.name as location, r.note
      from ritmo.shift_requests r
      join ritmo.shifts s on s.id = r.shift_id
      join ritmo.locations l on l.id = s.location_id
      join ritmo.members rq on rq.id = r.requester_member_id
      left join ritmo.members tg on tg.id = r.target_member_id
      where r.org_id = ${orgId} and r.status = 'pending' and ritmo.can_manage_location(s.org_id, s.location_id) ${locFilter('s')}
      order by s.starts_at`;

    const geofence = await tx<{ id: string; name: string; at: Date; distance: number; location: string }[]>`
      select a.id, m.first_name || ' ' || m.last_name as name, te.started_at as at,
             coalesce((a.details->>'distance_m')::int, 0) as distance, coalesce(a.details->>'location', l.name) as location
      from ritmo.anomalies a
      join ritmo.members m on m.id = a.member_id
      left join ritmo.time_entries te on te.id = a.time_entry_id
      left join ritmo.locations l on l.id = te.location_id
      where a.org_id = ${orgId} and a.status = 'open' and a.kind = 'out_of_geofence' and a.member_id <> ${ctx.member.memberId}
        ${locationId ? tx`and te.location_id = ${locationId}` : tx``}
      order by a.created_at desc limit 3`;

    const lastWs = addDays(ws, -7);
    const [pending] = await tx<{ n: number; issues: number }[]>`
      with worked as (
        select distinct te.member_id from ritmo.time_entries te
        where te.org_id = ${orgId} and te.work_date >= ${lastWs} and te.work_date < ${ws} and te.member_id <> ${ctx.member.memberId}
          ${locFilter('te')}
      )
      select count(*)::int as n,
             count(*) filter (where exists (
               select 1 from ritmo.anomalies a join ritmo.time_entries te on te.id = a.time_entry_id
               where a.member_id = w.member_id and a.status = 'open' and te.work_date >= ${lastWs} and te.work_date < ${ws}))::int as issues
      from worked w
      where not exists (select 1 from ritmo.timesheet_approvals ta where ta.member_id = w.member_id and ta.week_start = ${lastWs})`;

    const seg = await tx<{ member_id: string; name: string; kind: 'focus' | 'neutral' | 'idle' | 'break'; minutes: number; started_at: Date; open: boolean }[]>`
      select a.member_id, m.first_name || ' ' || m.last_name as name, a.kind,
             greatest(1, round(extract(epoch from (a.ended_at - a.started_at)) / 60))::int as minutes, a.started_at,
             exists (select 1 from ritmo.time_entries te where te.member_id = a.member_id and te.ended_at is null) as open
      from ritmo.activity_segments a join ritmo.members m on m.id = a.member_id
      where a.org_id = ${orgId} and a.started_at >= (${today}::date)::timestamp at time zone ${TZ}
        ${locationId ? tx`and m.primary_location_id = ${locationId}` : tx``}
      order by m.first_name, a.started_at`;
    const actMap = new Map<string, OverviewData['activity'][number]>();
    for (const s of seg) {
      const row = actMap.get(s.member_id) ?? { memberId: s.member_id, name: s.name, segments: [], activeMinutes: 0, live: s.open };
      const last = row.segments.at(-1);
      if (last && last.kind === s.kind) last.minutes += s.minutes;
      else row.segments.push({ kind: s.kind, minutes: s.minutes });
      if (s.kind === 'focus' || s.kind === 'neutral') row.activeMinutes += s.minutes;
      actMap.set(s.member_id, row);
    }

    return {
      onShift: onShift.map((r) => ({
        entryId: r.entry_id, memberId: r.member_id, firstName: r.first_name, lastName: r.last_name, avatarColor: r.avatar_color,
        position: r.position, location: r.location, startedAt: r.started_at, breakStartedAt: r.break_started_at, shiftStart: r.shift_start,
        source: r.source,
        workedMinutes: workedMinutes({ startedAt: r.started_at, endedAt: null, breakMinutes: r.break_minutes, breakStartedAt: r.break_started_at }, now),
      })),
      notInYet: notIn?.n ?? 0,
      dailyPeople,
      hoursWeek: sumWorked(thisWeek),
      hoursLastWeekSamePoint: sumWorked(lastWeekToPoint, weekAgo),
      dailyHours,
      overtimeWeek: ot(thisTotals),
      overtimeLastWeek: ot(lastTotals),
      overtimeTopLocation: otLocRows[0]?.name ?? null,
      dailyOvertime,
      payrollMinor,
      budgetMinor: Number(budget?.total ?? 0),
      requests: requests.map((r) => ({ id: r.id, kind: r.kind, requester: r.requester, target: r.target, startsAt: r.starts_at, endsAt: r.ends_at, location: r.location, note: r.note })),
      geofence,
      pendingTimesheets: { count: pending?.n ?? 0, withIssues: pending?.issues ?? 0, weekStart: lastWs },
      activity: [...actMap.values()],
    };
  });
}
