import 'server-only';
import { addDays, findConflicts, localDate, shiftCostMinor, shiftMinutes, zonedToUtc, type ShiftLike } from '@ritmo/core';
import type { Ctx } from '@/server/context';
import { TZ, fmtTime } from '@/lib/format';

export type Tint = 'green' | 'sun' | 'sky' | 'clay' | 'stone';

export interface BoardShift {
  id: string;
  memberId: string | null;
  positionId: string | null;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  notes: string;
  draft: boolean;
  conflict: 'overlap' | 'short_rest' | null;
  request: 'swap' | 'claim' | 'drop' | null;
}

export interface BoardMember {
  id: string;
  name: string;
  initials: string;
  tint: Tint;
  positionId: string | null;
  scheduledMinutes: number;
  contractMinutes: number | null;
}

export interface BoardRequest {
  id: string;
  kind: 'swap' | 'claim' | 'drop';
  requester: string;
  target: string | null;
  startsAt: Date;
  endsAt: Date;
}

export interface ScheduleData {
  locations: Array<{ id: string; name: string; budgetMinor: number }>;
  location: { id: string; name: string; budgetMinor: number } | null;
  members: BoardMember[];
  positions: Array<{ id: string; name: string; tint: Tint }>;
  shifts: BoardShift[];
  requests: BoardRequest[];
  costMinor: number;
}

/** Everything the week board needs for one location, read under RLS as the signed-in manager. */
export async function scheduleWeek(ctx: Ctx, ws: string, locId: string | undefined): Promise<ScheduleData> {
  const orgId = ctx.member.orgId;
  return ctx.db(async (tx) => {
    const locRows = await tx<{ id: string; name: string; weekly_budget_minor: bigint | null }[]>`
      select id, name, weekly_budget_minor from ritmo.locations
      where org_id = ${orgId} and ritmo.can_manage_location(org_id, id)
      order by (kind = 'branch') desc, sort_order, name`;
    const locations = locRows.map((l) => ({ id: l.id, name: l.name, budgetMinor: Number(l.weekly_budget_minor ?? 0) }));
    const location = locations.find((l) => l.id === locId) ?? locations[0] ?? null;
    const empty = { locations, location, members: [], positions: [], shifts: [], requests: [], costMinor: 0 };
    if (!location) return empty;

    const from = zonedToUtc(ws, '00:00', TZ);
    const to = zonedToUtc(addDays(ws, 7), '00:00', TZ);

    const memberRows = await tx<
      { id: string; first_name: string; last_name: string; avatar_color: Tint; position_id: string | null; contract_hours_week: string | null }[]
    >`
      select m.id, m.first_name, m.last_name, m.avatar_color, m.position_id, m.contract_hours_week
      from ritmo.members m join ritmo.member_locations ml on ml.member_id = m.id and ml.location_id = ${location.id}
      where m.org_id = ${orgId} and m.status = 'active'
      order by m.first_name, m.last_name`;

    const positions = await tx<{ id: string; name: string; tint: Tint }[]>`
      select id, name, color as tint from ritmo.positions where org_id = ${orgId} order by name`;

    const shiftRows = await tx<
      { id: string; location_id: string; member_id: string | null; position_id: string | null; starts_at: Date; ends_at: Date;
        break_minutes: number; status: 'draft' | 'published'; notes: string | null }[]
    >`
      select id, location_id, member_id, position_id, starts_at, ends_at, break_minutes, status, notes
      from ritmo.shifts
      where org_id = ${orgId} and starts_at < ${new Date(to.getTime() + 86_400_000)} and ends_at > ${new Date(from.getTime() - 86_400_000)}
        and (location_id = ${location.id} or member_id = any(${memberRows.map((m) => m.id)}::uuid[]))
      order by starts_at`;

    const requests = await tx<
      { id: string; shift_id: string; kind: 'swap' | 'claim' | 'drop'; requester: string; target: string | null; starts_at: Date; ends_at: Date }[]
    >`
      select r.id, r.shift_id, r.kind, rq.first_name || ' ' || rq.last_name as requester,
             tg.first_name || ' ' || tg.last_name as target, s.starts_at, s.ends_at
      from ritmo.shift_requests r
      join ritmo.shifts s on s.id = r.shift_id
      join ritmo.members rq on rq.id = r.requester_member_id
      left join ritmo.members tg on tg.id = r.target_member_id
      where r.org_id = ${orgId} and r.status = 'pending' and s.location_id = ${location.id}
        and s.starts_at >= ${from} and s.starts_at < ${to}
      order by s.starts_at`;

    const pay = await tx<{ member_id: string; hourly_rate_minor: bigint }[]>`
      select member_id, hourly_rate_minor from ritmo.member_pay where org_id = ${orgId}`;
    const rate = new Map(pay.map((p) => [p.member_id, Number(p.hourly_rate_minor)]));

    const like = (s: (typeof shiftRows)[number]): ShiftLike => ({
      id: s.id, memberId: s.member_id, startsAt: s.starts_at, endsAt: s.ends_at, breakMinutes: s.break_minutes,
    });
    const inWeek = shiftRows.filter((s) => s.location_id === location.id && s.starts_at >= from && s.starts_at < to);
    const reqByShift = new Map(requests.map((r) => [r.shift_id, r.kind]));

    const shifts: BoardShift[] = inWeek.map((s) => {
      const others = s.member_id ? shiftRows.filter((o) => o.member_id === s.member_id && o.id !== s.id).map(like) : [];
      const conflicts = s.member_id ? findConflicts(like(s), others, ctx.member.policy) : [];
      return {
        id: s.id,
        memberId: s.member_id,
        positionId: s.position_id,
        date: localDate(s.starts_at, TZ),
        start: fmtTime(s.starts_at),
        end: fmtTime(s.ends_at),
        breakMinutes: s.break_minutes,
        notes: s.notes ?? '',
        draft: s.status === 'draft',
        conflict: conflicts.find((c) => c.kind === 'overlap')?.kind ?? conflicts[0]?.kind ?? null,
        request: reqByShift.get(s.id) ?? null,
      };
    });

    // Hours count every location the person works at this week; cost counts this location only.
    const members: BoardMember[] = memberRows.map((m) => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`.trim(),
      initials: `${m.first_name[0] ?? ''}${m.last_name[0] ?? ''}`,
      tint: m.avatar_color,
      positionId: m.position_id,
      scheduledMinutes: shiftRows
        .filter((s) => s.member_id === m.id && s.starts_at >= from && s.starts_at < to)
        .reduce((sum, s) => sum + shiftMinutes(like(s)), 0),
      contractMinutes: m.contract_hours_week === null ? null : Math.round(Number(m.contract_hours_week) * 60),
    }));
    const costMinor = inWeek.reduce((sum, s) => sum + (s.member_id ? shiftCostMinor(like(s), rate.get(s.member_id) ?? 0) : 0), 0);

    return {
      locations,
      location,
      members,
      positions,
      shifts,
      requests: requests.map((r) => ({ id: r.id, kind: r.kind, requester: r.requester, target: r.target, startsAt: r.starts_at, endsAt: r.ends_at })),
      costMinor,
    };
  });
}
