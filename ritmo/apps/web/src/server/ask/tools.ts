import 'server-only';
import { addDays, lateMinutes, weekStart } from '@ritmo/core';
import type { Ctx } from '../context';
import { overview } from '../queries';
import { weekSheet } from '../time-queries';
import { fmtDuration, fmtTime, todayLocal } from '@/lib/format';

/**
 * Read-only tools for "Ask Ritmo". Every query runs as the signed-in manager
 * under Row-Level Security, so answers never include data they can't see.
 * Nothing here writes.
 */
export type ToolName =
  | 'on_shift_now'
  | 'not_clocked_in'
  | 'week_hours'
  | 'open_issues'
  | 'pending_requests'
  | 'labor_cost'
  | 'open_shifts'
  | 'find_person'
  | 'schedule_on';

export const TOOL_LINKS: Record<ToolName, string> = {
  on_shift_now: '/overview',
  not_clocked_in: '/overview',
  week_hours: '/time',
  open_issues: '/time',
  pending_requests: '/schedule',
  labor_cost: '/overview',
  open_shifts: '/schedule',
  find_person: '/people',
  schedule_on: '/schedule',
};

const name = (f: string, l: string) => `${f} ${l}`.trim();

export async function runTool(ctx: Ctx, tool: ToolName, input: Record<string, unknown>): Promise<unknown> {
  const tz = ctx.member.timezone;
  const today = todayLocal(tz);
  switch (tool) {
    case 'on_shift_now': {
      const d = await overview(ctx, null);
      return {
        count: d.onShift.length,
        people: d.onShift.map((p) => ({
          name: name(p.firstName, p.lastName),
          location: p.location,
          since: fmtTime(p.startedAt, tz),
          onBreak: p.breakStartedAt !== null,
          lateMinutes: p.shiftStart ? lateMinutes(p.shiftStart, p.startedAt, ctx.member.policy) : 0,
          fromComputer: p.source === 'desktop',
        })),
      };
    }
    case 'not_clocked_in': {
      const rows = await ctx.db((tx) => tx<{ first_name: string; last_name: string; location: string; starts_at: Date }[]>`
        select m.first_name, m.last_name, l.name as location, s.starts_at
        from ritmo.shifts s
        join ritmo.members m on m.id = s.member_id
        join ritmo.locations l on l.id = s.location_id
        where s.org_id = ${ctx.member.orgId} and s.status = 'published' and s.starts_at <= now() and s.ends_at > now()
          and not exists (select 1 from ritmo.time_entries te where te.member_id = s.member_id and te.started_at >= s.starts_at - interval '3 hours'
                          and (te.ended_at is null or te.ended_at > s.starts_at))
        order by s.starts_at`);
      return {
        count: rows.length,
        people: rows.map((r) => ({ name: name(r.first_name, r.last_name), location: r.location, shiftStart: fmtTime(r.starts_at, tz) })),
      };
    }
    case 'week_hours': {
      const ws = weekStart(today);
      const rows = await weekSheet(ctx, ws, null);
      const total = rows.reduce((s, r) => s + r.totals.total, 0);
      const overtime = rows.reduce((s, r) => s + r.totals.overtime1 + r.totals.overtime2, 0);
      const top = [...rows]
        .sort((a, b) => b.totals.overtime1 + b.totals.overtime2 - (a.totals.overtime1 + a.totals.overtime2))
        .filter((r) => r.totals.overtime1 + r.totals.overtime2 > 0)
        .slice(0, 5);
      return {
        week: `${ws} – ${addDays(ws, 6)}`,
        totalHours: fmtDuration(total),
        overtimeHours: fmtDuration(overtime),
        people: rows.length,
        waitingApproval: rows.filter((r) => r.approval === 'waiting').length,
        topOvertime: top.map((r) => ({ name: name(r.firstName, r.lastName), overtime: fmtDuration(r.totals.overtime1 + r.totals.overtime2), total: fmtDuration(r.totals.total) })),
      };
    }
    case 'open_issues': {
      const rows = await ctx.db((tx) => tx<{ first_name: string; last_name: string; kind: string; created_at: Date }[]>`
        select m.first_name, m.last_name, a.kind, a.created_at
        from ritmo.anomalies a join ritmo.members m on m.id = a.member_id
        where a.org_id = ${ctx.member.orgId} and a.status = 'open' and a.member_id <> ${ctx.member.memberId}
        order by a.created_at desc limit 20`);
      return { count: rows.length, issues: rows.map((r) => ({ name: name(r.first_name, r.last_name), kind: r.kind, at: fmtTime(r.created_at, tz) })) };
    }
    case 'pending_requests': {
      const d = await overview(ctx, null);
      return {
        count: d.requests.length,
        requests: d.requests.map((r) => ({
          kind: r.kind, requester: r.requester, target: r.target, location: r.location,
          day: r.startsAt.toISOString().slice(0, 10), time: `${fmtTime(r.startsAt, tz)}–${fmtTime(r.endsAt, tz)}`,
        })),
      };
    }
    case 'labor_cost': {
      const d = await overview(ctx, null);
      return {
        payrollThisWeek: Math.round(d.payrollMinor / 100),
        budgetThisWeek: Math.round(d.budgetMinor / 100),
        percentOfBudget: d.budgetMinor > 0 ? Math.round((d.payrollMinor / d.budgetMinor) * 100) : null,
        currency: 'ILS',
        overtimeHours: fmtDuration(d.overtimeWeek),
        overtimeMostlyAt: d.overtimeTopLocation,
      };
    }
    case 'open_shifts': {
      const rows = await ctx.db((tx) => tx<{ location: string; position: string | null; starts_at: Date; ends_at: Date }[]>`
        select l.name as location, p.name as position, s.starts_at, s.ends_at
        from ritmo.shifts s join ritmo.locations l on l.id = s.location_id left join ritmo.positions p on p.id = s.position_id
        where s.org_id = ${ctx.member.orgId} and s.member_id is null and s.starts_at > now() and s.starts_at < now() + interval '14 days'
        order by s.starts_at limit 20`);
      return {
        count: rows.length,
        shifts: rows.map((r) => ({ location: r.location, position: r.position, day: r.starts_at.toISOString().slice(0, 10), time: `${fmtTime(r.starts_at, tz)}–${fmtTime(r.ends_at, tz)}` })),
      };
    }
    case 'find_person': {
      const q = String(input.name ?? '').trim().slice(0, 60);
      if (!q) return { error: 'name is required' };
      const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      const ws = weekStart(today);
      const rows = await ctx.db((tx) => tx<{ id: string; first_name: string; last_name: string; role: string; title: string | null; phone: string | null; location: string | null }[]>`
        select m.id, m.first_name, m.last_name, m.role, coalesce(m.title, p.name) as title, m.phone, l.name as location
        from ritmo.members m left join ritmo.positions p on p.id = m.position_id left join ritmo.locations l on l.id = m.primary_location_id
        where m.org_id = ${ctx.member.orgId} and m.status = 'active' and (m.first_name || ' ' || m.last_name) ilike ${like}
        order by m.first_name limit 5`);
      const sheet = await weekSheet(ctx, ws, null);
      const people = await Promise.all(
        rows.map(async (r) => {
          const [next] = await ctx.db((tx) => tx<{ starts_at: Date; ends_at: Date; location: string }[]>`
            select s.starts_at, s.ends_at, l.name as location from ritmo.shifts s join ritmo.locations l on l.id = s.location_id
            where s.member_id = ${r.id} and s.starts_at > now() and s.status = 'published' order by s.starts_at limit 1`);
          const week = sheet.find((s) => s.memberId === r.id);
          return {
            name: name(r.first_name, r.last_name), role: r.role, title: r.title, location: r.location, phone: r.phone,
            hoursThisWeek: week ? fmtDuration(week.totals.total) : '0:00', openIssues: week?.openIssues ?? 0,
            nextShift: next ? { day: next.starts_at.toISOString().slice(0, 10), time: `${fmtTime(next.starts_at, tz)}–${fmtTime(next.ends_at, tz)}`, location: next.location } : null,
          };
        }),
      );
      return { count: people.length, people };
    }
    case 'schedule_on': {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date ?? '')) ? String(input.date) : today;
      const rows = await ctx.db((tx) => tx<{ first_name: string | null; last_name: string | null; location: string; position: string | null; starts_at: Date; ends_at: Date; status: string }[]>`
        select m.first_name, m.last_name, l.name as location, p.name as position, s.starts_at, s.ends_at, s.status
        from ritmo.shifts s join ritmo.locations l on l.id = s.location_id
        left join ritmo.members m on m.id = s.member_id left join ritmo.positions p on p.id = s.position_id
        where s.org_id = ${ctx.member.orgId} and (s.starts_at at time zone ${tz})::date = ${date}
        order by l.sort_order, s.starts_at limit 80`);
      return {
        date,
        count: rows.length,
        shifts: rows.map((r) => ({
          who: r.first_name ? name(r.first_name, r.last_name ?? '') : null, location: r.location, position: r.position,
          time: `${fmtTime(r.starts_at, tz)}–${fmtTime(r.ends_at, tz)}`, draft: r.status === 'draft',
        })),
      };
    }
  }
}
