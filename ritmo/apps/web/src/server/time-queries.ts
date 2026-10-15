import 'server-only';
import { addDays, weekStart, weekTotals, workedMinutes, type WeekTotals } from '@ritmo/core';
import type { Ctx } from './context';
import { entriesBetween, toEntry, type EntryRow } from './queries';
import { TZ, todayLocal } from '@/lib/format';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string | undefined): s is string => !!s && DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** The Sunday that starts the week containing `param`, or the current week. */
export const parseWeek = (param?: string) => weekStart(validDate(param) ? param : todayLocal());
/** A YYYY-MM-DD date, or today. */
export const parseDate = (param?: string) => (validDate(param) ? param : todayLocal());

export type ApprovalStatus = 'approved' | 'rejected' | 'waiting';

export interface SheetRow {
  memberId: string;
  firstName: string;
  lastName: string;
  avatarColor: string;
  employeeNo: string | null;
  location: string;
  totals: WeekTotals;
  openIssues: number;
  approval: ApprovalStatus;
  running: boolean;
  isSelf: boolean;
}

/**
 * One row per managed member with hours in the week, split with the org's
 * attendance policy. Location filter applies to the entries' location.
 */
export async function weekSheet(ctx: Ctx, ws: string, locationId: string | null): Promise<SheetRow[]> {
  const orgId = ctx.member.orgId;
  const we = addDays(ws, 7);
  return ctx.db(async (tx) => {
    const entries = (await entriesBetween(tx, orgId, ws, we, locationId)) as EntryRow[];
    const ids = [...new Set(entries.map((e) => e.member_id))];
    if (ids.length === 0) return [];
    const members = await tx<
      { id: string; first_name: string; last_name: string; avatar_color: string; employee_no: string | null; location: string | null; approval: 'approved' | 'rejected' | null; issues: number }[]
    >`
      select m.id, m.first_name, m.last_name, m.avatar_color, m.employee_no, l.name as location, ta.status as approval,
             (select count(*)::int from ritmo.anomalies a join ritmo.time_entries te on te.id = a.time_entry_id
               where a.member_id = m.id and a.status = 'open' and te.work_date >= ${ws} and te.work_date < ${we}) as issues
      from ritmo.members m
      left join ritmo.locations l on l.id = m.primary_location_id
      left join ritmo.timesheet_approvals ta on ta.member_id = m.id and ta.week_start = ${ws}
      where m.org_id = ${orgId} and m.id = any(${ids}::uuid[]) and ritmo.can_manage_member(m.org_id, m.id)
      order by m.first_name, m.last_name`;
    const now = new Date();
    return members.map((m) => {
      const mine = entries.filter((e) => e.member_id === m.id);
      return {
        memberId: m.id,
        firstName: m.first_name,
        lastName: m.last_name,
        avatarColor: m.avatar_color,
        employeeNo: m.employee_no,
        location: m.location ?? '',
        totals: weekTotals(mine.map(toEntry), ctx.member.policy, TZ, now),
        openIssues: m.issues,
        approval: m.approval ?? 'waiting',
        running: mine.some((e) => !e.ended_at),
        isSelf: m.id === ctx.member.memberId,
      };
    });
  });
}

export interface DetailEntry {
  id: string;
  workDate: string;
  startedAt: Date;
  endedAt: Date | null;
  breakMinutes: number;
  worked: number;
  source: string | null;
  editedReason: string | null;
}

export interface DetailAnomaly {
  id: string;
  kind: 'late' | 'out_of_geofence' | 'long_shift' | 'missing_break' | 'no_clock_out';
  status: 'open' | 'resolved';
  workDate: string | null;
}

export interface DetailEvent {
  id: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  occurredAt: Date;
  source: string;
  insideGeofence: boolean | null;
}

export interface MemberWeek {
  member: { id: string; firstName: string; lastName: string; avatarColor: string; title: string | null; location: string | null };
  entries: DetailEntry[];
  totals: WeekTotals;
  anomalies: DetailAnomaly[];
  events: DetailEvent[];
  approval: ApprovalStatus;
  isSelf: boolean;
}

/** A managed member's week, or null when the member isn't visible/managed. */
export async function memberWeek(ctx: Ctx, memberId: string, ws: string): Promise<MemberWeek | null> {
  const orgId = ctx.member.orgId;
  const we = addDays(ws, 7);
  return ctx.db(async (tx) => {
    const [m] = await tx<
      { id: string; first_name: string; last_name: string; avatar_color: string; title: string | null; location: string | null; approval: 'approved' | 'rejected' | null }[]
    >`
      select m.id, m.first_name, m.last_name, m.avatar_color, coalesce(m.title, p.name) as title, l.name as location, ta.status as approval
      from ritmo.members m
      left join ritmo.positions p on p.id = m.position_id
      left join ritmo.locations l on l.id = m.primary_location_id
      left join ritmo.timesheet_approvals ta on ta.member_id = m.id and ta.week_start = ${ws}
      where m.org_id = ${orgId} and m.id = ${memberId} and ritmo.can_manage_member(m.org_id, m.id)`;
    if (!m) return null;

    const rows = await tx<(EntryRow & { source: string | null })[]>`
      select te.id, te.member_id, te.location_id, te.shift_id, te.work_date::text as work_date, te.started_at, te.ended_at,
             te.break_minutes, te.break_started_at, te.edited_reason,
             (select ev.source from ritmo.time_events ev where ev.member_id = te.member_id and ev.type = 'clock_in'
                and ev.occurred_at between te.started_at - interval '12 hours' and te.started_at + interval '12 hours'
              order by abs(extract(epoch from ev.occurred_at - te.started_at)) limit 1) as source
      from ritmo.time_entries te
      where te.org_id = ${orgId} and te.member_id = ${memberId} and te.work_date >= ${ws} and te.work_date < ${we}
      order by te.started_at`;

    const anomalies = await tx<{ id: string; kind: DetailAnomaly['kind']; status: 'open' | 'resolved'; work_date: string | null }[]>`
      select a.id, a.kind, a.status, te.work_date::text as work_date
      from ritmo.anomalies a join ritmo.time_entries te on te.id = a.time_entry_id
      where a.org_id = ${orgId} and a.member_id = ${memberId} and te.work_date >= ${ws} and te.work_date < ${we}
      order by a.status, te.started_at`;

    const events = await tx<{ id: string; type: DetailEvent['type']; occurred_at: Date; source: string; inside_geofence: boolean | null }[]>`
      select ev.id, ev.type, ev.occurred_at, ev.source, ev.inside_geofence
      from ritmo.time_events ev
      where ev.org_id = ${orgId} and ev.member_id = ${memberId}
        and ev.occurred_at >= (${ws}::date)::timestamp at time zone ${TZ}
        and ev.occurred_at < (${we}::date)::timestamp at time zone ${TZ}
      order by ev.occurred_at`;

    const now = new Date();
    return {
      member: { id: m.id, firstName: m.first_name, lastName: m.last_name, avatarColor: m.avatar_color, title: m.title, location: m.location },
      entries: rows.map((e) => ({
        id: e.id,
        workDate: e.work_date,
        startedAt: e.started_at,
        endedAt: e.ended_at,
        breakMinutes: e.break_minutes,
        worked: workedMinutes(toEntry(e), now),
        source: e.source,
        editedReason: e.edited_reason,
      })),
      totals: weekTotals(rows.map(toEntry), ctx.member.policy, TZ, now),
      anomalies: anomalies.map((a) => ({ id: a.id, kind: a.kind, status: a.status, workDate: a.work_date })),
      events: events.map((e) => ({ id: e.id, type: e.type, occurredAt: e.occurred_at, source: e.source, insideGeofence: e.inside_geofence })),
      approval: m.approval ?? 'waiting',
      isSelf: m.id === ctx.member.memberId,
    };
  });
}

export type SegKind = 'focus' | 'neutral' | 'idle' | 'break';

export interface ActivityRow {
  memberId: string;
  name: string;
  title: string | null;
  segments: Array<{ kind: SegKind; start: Date; end: Date }>;
  active: number;
  idle: number;
  apps: Array<{ app: string; minutes: number }>;
}

/**
 * Computer activity for one local day: aggregate segments (kind, app name,
 * time) of the members the viewer manages. Never content.
 */
export async function activityDay(ctx: Ctx, date: string): Promise<ActivityRow[]> {
  const orgId = ctx.member.orgId;
  return ctx.db(async (tx) => {
    const segs = await tx<{ member_id: string; name: string; title: string | null; kind: SegKind; app: string | null; started_at: Date; ended_at: Date }[]>`
      select a.member_id, m.first_name || ' ' || m.last_name as name, coalesce(m.title, p.name) as title,
             a.kind, a.app, a.started_at, a.ended_at
      from ritmo.activity_segments a
      join ritmo.members m on m.id = a.member_id
      left join ritmo.positions p on p.id = m.position_id
      where a.org_id = ${orgId}
        and a.started_at >= (${date}::date)::timestamp at time zone ${TZ}
        and a.started_at < (${addDays(date, 1)}::date)::timestamp at time zone ${TZ}
        and ritmo.can_manage_member(a.org_id, a.member_id)
      order by m.first_name, m.last_name, a.started_at`;
    const by = new Map<string, ActivityRow & { appMap: Map<string, number> }>();
    for (const s of segs) {
      const row: ActivityRow & { appMap: Map<string, number> } =
        by.get(s.member_id) ?? { memberId: s.member_id, name: s.name, title: s.title, segments: [], active: 0, idle: 0, apps: [], appMap: new Map() };
      const minutes = Math.max(1, Math.round((s.ended_at.getTime() - s.started_at.getTime()) / 60_000));
      row.segments.push({ kind: s.kind, start: s.started_at, end: s.ended_at });
      if (s.kind === 'focus' || s.kind === 'neutral') {
        row.active += minutes;
        if (s.app) row.appMap.set(s.app, (row.appMap.get(s.app) ?? 0) + minutes);
      } else if (s.kind === 'idle') row.idle += minutes;
      by.set(s.member_id, row);
    }
    return [...by.values()].map(({ appMap, ...r }) => ({
      ...r,
      apps: [...appMap.entries()].map(([app, minutes]) => ({ app, minutes })).sort((a, b) => b.minutes - a.minutes).slice(0, 4),
    }));
  });
}
