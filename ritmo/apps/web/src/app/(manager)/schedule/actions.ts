'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { pgErrorCode } from '@ritmo/db';
import { addDays, localDate, zonedToUtc } from '@ritmo/core';
import { requireManager } from '@/server/context';
import { TZ, fmtTime } from '@/lib/format';
import type { ActionResult } from '../actions';

export type ScheduleResult = ActionResult | { ok: true; count: number };

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const shiftInput = z.object({
  id: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  memberId: z.string().uuid().nullable(),
  positionId: z.string().uuid().nullable(),
  date,
  start: time,
  end: time,
  breakMinutes: z.number().int().min(0).max(240),
  notes: z.string().max(500),
});
export type ShiftInput = z.infer<typeof shiftInput>;

function fail(err: unknown): ActionResult {
  const code = pgErrorCode(err);
  if (code === '42501') return { ok: false, error: 'forbidden' };
  if (code === '23P01') return { ok: false, error: 'overlap' };
  console.error(err);
  return { ok: false, error: 'error' };
}

/** An end at or before the start means the shift runs past midnight. */
function span(d: string, start: string, end: string) {
  const startsAt = zonedToUtc(d, start, TZ);
  const endsAt = zonedToUtc(end > start ? d : addDays(d, 1), end, TZ);
  return { startsAt, endsAt };
}

export async function saveShift(raw: ShiftInput): Promise<ActionResult> {
  const ctx = await requireManager();
  const parsed = shiftInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'error' };
  const s = parsed.data;
  if (s.end === s.start) return { ok: false, error: 'endBeforeStart' };
  const { startsAt, endsAt } = span(s.date, s.start, s.end);
  if (endsAt.getTime() - startsAt.getTime() > 16 * 3_600_000) return { ok: false, error: 'tooLong' };
  if (s.breakMinutes >= (endsAt.getTime() - startsAt.getTime()) / 60_000) return { ok: false, error: 'breakTooLong' };
  const orgId = ctx.member.orgId;
  try {
    const done = await ctx.db(async (tx) => {
      const rows = s.id
        ? await tx<{ id: string }[]>`
            update ritmo.shifts set member_id = ${s.memberId}, position_id = ${s.positionId}, starts_at = ${startsAt},
              ends_at = ${endsAt}, break_minutes = ${s.breakMinutes}, notes = ${s.notes || null}, status = 'draft', published_at = null
            where id = ${s.id} and org_id = ${orgId} and location_id = ${s.locationId} returning id`
        : await tx<{ id: string }[]>`
            insert into ritmo.shifts (org_id, location_id, member_id, position_id, starts_at, ends_at, break_minutes, notes, created_by)
            values (${orgId}, ${s.locationId}, ${s.memberId}, ${s.positionId}, ${startsAt}, ${endsAt}, ${s.breakMinutes},
                    ${s.notes || null}, ${ctx.member.memberId})
            returning id`;
      const id = rows[0]?.id;
      if (id) await tx`select ritmo.audit(${orgId}, ${s.id ? 'shift.update' : 'shift.create'}, 'shift', ${id})`;
      return Boolean(id);
    });
    if (!done) return { ok: false, error: 'forbidden' };
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/schedule');
  return { ok: true };
}

/** Drag-and-drop: same local times, new day and/or person. Moved shifts go back to draft. */
export async function moveShift(shiftId: string, memberId: string | null, toDate: string): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!z.string().uuid().safeParse(shiftId).success || !date.safeParse(toDate).success) return { ok: false, error: 'error' };
  if (memberId !== null && !z.string().uuid().safeParse(memberId).success) return { ok: false, error: 'error' };
  const orgId = ctx.member.orgId;
  try {
    const done = await ctx.db(async (tx) => {
      const [cur] = await tx<{ starts_at: Date; ends_at: Date }[]>`
        select starts_at, ends_at from ritmo.shifts where id = ${shiftId} and org_id = ${orgId}`;
      if (!cur) return false;
      const startsAt = zonedToUtc(toDate, fmtTime(cur.starts_at), TZ);
      const endsAt = new Date(startsAt.getTime() + (cur.ends_at.getTime() - cur.starts_at.getTime()));
      const rows = await tx`
        update ritmo.shifts set member_id = ${memberId}, starts_at = ${startsAt}, ends_at = ${endsAt}, status = 'draft', published_at = null
        where id = ${shiftId} and org_id = ${orgId} returning id`;
      if (rows.length)
        await tx`select ritmo.audit(${orgId}, 'shift.move', 'shift', ${shiftId}, ${tx.json({ from: localDate(cur.starts_at, TZ), to: toDate })})`;
      return rows.length > 0;
    });
    if (!done) return { ok: false, error: 'forbidden' };
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/schedule');
  return { ok: true };
}

export async function deleteShift(shiftId: string): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!z.string().uuid().safeParse(shiftId).success) return { ok: false, error: 'error' };
  const orgId = ctx.member.orgId;
  try {
    const done = await ctx.db(async (tx) => {
      const rows = await tx`delete from ritmo.shifts where id = ${shiftId} and org_id = ${orgId} returning id`;
      if (rows.length) await tx`select ritmo.audit(${orgId}, 'shift.delete', 'shift', ${shiftId})`;
      return rows.length > 0;
    });
    if (!done) return { ok: false, error: 'forbidden' };
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/schedule');
  return { ok: true };
}

/** Publishes the drafts of one week at one location. */
export async function publishWeek(locationId: string, ws: string): Promise<ScheduleResult> {
  const ctx = await requireManager();
  if (!z.string().uuid().safeParse(locationId).success || !date.safeParse(ws).success) return { ok: false, error: 'error' };
  const orgId = ctx.member.orgId;
  try {
    const count = await ctx.db(async (tx) => {
      const rows = await tx`
        update ritmo.shifts set status = 'published', published_at = now()
        where org_id = ${orgId} and location_id = ${locationId} and status = 'draft'
          and starts_at >= ${zonedToUtc(ws, '00:00', TZ)} and starts_at < ${zonedToUtc(addDays(ws, 7), '00:00', TZ)}
        returning id`;
      if (rows.length)
        await tx`select ritmo.audit(${orgId}, 'schedule.publish', 'location', ${locationId}, ${tx.json({ week: ws, shifts: rows.length })})`;
      return rows.length;
    });
    revalidatePath('/schedule');
    return { ok: true, count };
  } catch (err) {
    return fail(err);
  }
}
