'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkGeofence, lateMinutes, localDate, matchShift, workedMinutes } from '@ritmo/core';
import { pgErrorCode, type Tx } from '@ritmo/db';
import { requireCtx, type Ctx } from '@/server/context';

export type MeError =
  | 'forbidden'
  | 'error'
  | 'alreadyIn'
  | 'notIn'
  | 'geoBlocked'
  | 'alreadyRequested'
  | 'tooLate'
  | 'invalid';

export type MeResult<T = object> = ({ ok: true } & T) | { ok: false; error: MeError };

function fail(err: unknown, unique: MeError = 'error'): { ok: false; error: MeError } {
  const code = pgErrorCode(err);
  if (code === '23505') return { ok: false, error: unique };
  if (code === '42501') return { ok: false, error: 'forbidden' };
  console.error(err);
  return { ok: false, error: 'error' };
}

function refresh() {
  revalidatePath('/me');
  revalidatePath('/overview');
}

const position = z
  .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100_000).nullable() })
  .nullable();

const clockInInput = z.object({ eventId: z.string().uuid(), position });

interface ShiftRow {
  id: string;
  location_id: string;
  starts_at: Date;
  ends_at: Date;
}

interface SiteRow {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  geofence_radius_m: number;
}

async function openEntry(tx: Tx, ctx: Ctx) {
  const [row] = await tx<{ id: string; started_at: Date; break_minutes: number; break_started_at: Date | null; location_id: string | null }[]>`
    select id, started_at, break_minutes, break_started_at, location_id
    from ritmo.time_entries where member_id = ${ctx.member.memberId} and ended_at is null for update`;
  return row ?? null;
}

/**
 * Clock in. Times come from the server clock, never the browser. The
 * position is checked against the shift's branch: outside (or no position)
 * is flagged for the manager, or refused when the policy says "block".
 */
export async function clockIn(input: z.input<typeof clockInInput>): Promise<MeResult<{ startedAt: string }>> {
  const ctx = await requireCtx();
  const parsed = clockInInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { eventId, position: pos } = parsed.data;
  const me = ctx.member;
  const policy = me.policy;
  const now = new Date();

  try {
    const result = await ctx.db(async (tx): Promise<MeResult<{ startedAt: string }>> => {
      if (await openEntry(tx, ctx)) return { ok: false, error: 'alreadyIn' };

      const shifts = await tx<ShiftRow[]>`
        select id, location_id, starts_at, ends_at from ritmo.shifts
        where member_id = ${me.memberId} and status = 'published'
          and starts_at between ${new Date(now.getTime() - 12 * 3600_000)} and ${new Date(now.getTime() + 12 * 3600_000)}`;
      const shift = matchShift(now, shifts.map((s) => ({ ...s, startsAt: s.starts_at, endsAt: s.ends_at })));

      const [site] = await tx<SiteRow[]>`
        select id, name, lat, lng, geofence_radius_m from ritmo.locations
        where id = coalesce(${shift?.location_id ?? null}::uuid,
                            (select primary_location_id from ritmo.members where id = ${me.memberId}))`;
      const fence =
        site && site.lat !== null && site.lng !== null && policy.geofenceMode !== 'off'
          ? checkGeofence(pos ? { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : null, { lat: site.lat, lng: site.lng, radius: site.geofence_radius_m })
          : { inside: null, distance: null };
      if (policy.geofenceMode === 'block' && fence.inside !== true) return { ok: false, error: 'geoBlocked' };

      await tx`
        insert into ritmo.time_events (id, org_id, member_id, type, occurred_at, source, location_id,
                                       lat, lng, accuracy_m, distance_m, inside_geofence)
        values (${eventId}, ${me.orgId}, ${me.memberId}, 'clock_in', ${now}, 'web', ${site?.id ?? null},
                ${pos?.lat ?? null}, ${pos?.lng ?? null}, ${pos?.accuracy ?? null}, ${fence.distance}, ${fence.inside})
        on conflict (id) do nothing`;
      const [entry] = await tx<{ id: string }[]>`
        insert into ritmo.time_entries (org_id, member_id, location_id, shift_id, work_date, started_at)
        values (${me.orgId}, ${me.memberId}, ${site?.id ?? null}, ${shift?.id ?? null}, ${localDate(now, me.timezone)}, ${now})
        returning id`;

      // Flag for the manager: outside the branch, or no position while a fence exists.
      const flagGeo = policy.geofenceMode !== 'off' && site?.lat != null && fence.inside !== true;
      if (flagGeo && entry) {
        await tx`
          insert into ritmo.anomalies (org_id, member_id, time_entry_id, kind, details)
          values (${me.orgId}, ${me.memberId}, ${entry.id}, 'out_of_geofence',
                  ${tx.json({ distance_m: fence.distance ?? 0, location: site?.name ?? '', no_position: pos === null })})`;
      }
      const late = shift ? lateMinutes(shift.starts_at, now, policy) : 0;
      if (late > 0 && entry) {
        await tx`
          insert into ritmo.anomalies (org_id, member_id, time_entry_id, kind, details)
          values (${me.orgId}, ${me.memberId}, ${entry.id}, 'late', ${tx.json({ minutes: late })})`;
      }
      return { ok: true, startedAt: now.toISOString() };
    });
    if (result.ok) refresh();
    return result;
  } catch (err) {
    return fail(err, 'alreadyIn');
  }
}

const eventInput = z.object({ eventId: z.string().uuid() });

export async function toggleBreak(input: z.input<typeof eventInput>): Promise<MeResult<{ onBreak: boolean }>> {
  const ctx = await requireCtx();
  const parsed = eventInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const me = ctx.member;
  const now = new Date();
  try {
    const result = await ctx.db(async (tx): Promise<MeResult<{ onBreak: boolean }>> => {
      const entry = await openEntry(tx, ctx);
      if (!entry) return { ok: false, error: 'notIn' };
      const starting = !entry.break_started_at;
      await tx`
        insert into ritmo.time_events (id, org_id, member_id, type, occurred_at, source, location_id)
        values (${parsed.data.eventId}, ${me.orgId}, ${me.memberId}, ${starting ? 'break_start' : 'break_end'}, ${now}, 'web', ${entry.location_id})
        on conflict (id) do nothing`;
      if (starting) {
        await tx`update ritmo.time_entries set break_started_at = ${now} where id = ${entry.id}`;
      } else {
        const minutes = Math.max(1, Math.round((now.getTime() - entry.break_started_at!.getTime()) / 60000));
        await tx`
          update ritmo.time_entries set break_minutes = break_minutes + ${minutes}, break_started_at = null
          where id = ${entry.id}`;
      }
      return { ok: true, onBreak: starting };
    });
    if (result.ok) refresh();
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function clockOut(input: z.input<typeof eventInput>): Promise<MeResult<{ workedMinutes: number }>> {
  const ctx = await requireCtx();
  const parsed = eventInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const me = ctx.member;
  const policy = me.policy;
  try {
    const result = await ctx.db(async (tx): Promise<MeResult<{ workedMinutes: number }>> => {
      const entry = await openEntry(tx, ctx);
      if (!entry) return { ok: false, error: 'notIn' };
      // An entry must end after it starts, even for a same-second tap.
      const end = new Date(Math.max(Date.now(), entry.started_at.getTime() + 1000));
      let breakMinutes = entry.break_minutes;
      if (entry.break_started_at) {
        breakMinutes += Math.max(1, Math.round((end.getTime() - entry.break_started_at.getTime()) / 60000));
        await tx`
          insert into ritmo.time_events (id, org_id, member_id, type, occurred_at, source, location_id)
          values (gen_random_uuid(), ${me.orgId}, ${me.memberId}, 'break_end', ${end}, 'web', ${entry.location_id})`;
      }
      await tx`
        insert into ritmo.time_events (id, org_id, member_id, type, occurred_at, source, location_id)
        values (${parsed.data.eventId}, ${me.orgId}, ${me.memberId}, 'clock_out', ${end}, 'web', ${entry.location_id})
        on conflict (id) do nothing`;
      await tx`
        update ritmo.time_entries
        set ended_at = ${end}, status = 'closed', break_minutes = ${breakMinutes}, break_started_at = null
        where id = ${entry.id}`;
      const worked = workedMinutes({ startedAt: entry.started_at, endedAt: end, breakMinutes });
      if (worked > policy.breakRequiredAfterMinutes && breakMinutes < policy.minBreakMinutes) {
        await tx`
          insert into ritmo.anomalies (org_id, member_id, time_entry_id, kind, details)
          values (${me.orgId}, ${me.memberId}, ${entry.id}, 'missing_break', ${tx.json({ break_minutes: breakMinutes })})`;
      }
      return { ok: true, workedMinutes: worked };
    });
    if (result.ok) refresh();
    return result;
  } catch (err) {
    return fail(err);
  }
}

const id = z.string().uuid();

/** Swap: a colleague takes my shift (pending until a manager approves). */
export async function requestSwap(shiftId: string, targetMemberId: string): Promise<MeResult> {
  const ctx = await requireCtx();
  if (!id.safeParse(shiftId).success || !id.safeParse(targetMemberId).success || targetMemberId === ctx.member.memberId) {
    return { ok: false, error: 'invalid' };
  }
  return createRequest(ctx, 'swap', shiftId, targetMemberId);
}

/** Claim an open shift (pending until a manager approves). */
export async function claimShift(shiftId: string): Promise<MeResult> {
  const ctx = await requireCtx();
  if (!id.safeParse(shiftId).success) return { ok: false, error: 'invalid' };
  return createRequest(ctx, 'claim', shiftId, null);
}

async function createRequest(ctx: Ctx, kind: 'swap' | 'claim', shiftId: string, target: string | null): Promise<MeResult> {
  try {
    await ctx.db(async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into ritmo.shift_requests (org_id, kind, shift_id, requester_member_id, target_member_id)
        values (${ctx.member.orgId}, ${kind}, ${shiftId}, ${ctx.member.memberId}, ${target})
        returning id`;
      await tx`select ritmo.audit(${ctx.member.orgId}, ${`shift_request.${kind}`}, 'shift_request', ${row!.id})`;
    });
  } catch (err) {
    // RLS refuses requests on past, draft or someone else's shifts.
    const failed = fail(err, 'alreadyRequested');
    return failed.error === 'forbidden' ? { ok: false, error: 'tooLate' } : failed;
  }
  revalidatePath('/me/shifts');
  refresh();
  return { ok: true };
}

export async function cancelRequest(requestId: string): Promise<MeResult> {
  const ctx = await requireCtx();
  if (!id.safeParse(requestId).success) return { ok: false, error: 'invalid' };
  try {
    const rows = await ctx.db((tx) => tx`
      update ritmo.shift_requests set status = 'cancelled'
      where id = ${requestId} and requester_member_id = ${ctx.member.memberId} and status = 'pending'
      returning id`);
    if (!rows.length) return { ok: false, error: 'invalid' };
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/me/shifts');
  refresh();
  return { ok: true };
}

const correctionInput = z.string().trim().min(3).max(300);

/** "Request a correction" on what's collected: recorded in the audit log for admins. */
export async function requestCorrection(note: string): Promise<MeResult> {
  const ctx = await requireCtx();
  const parsed = correctionInput.safeParse(note);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  try {
    await ctx.db((tx) => tx`
      select ritmo.audit(${ctx.member.orgId}, 'data.correction_request', 'member', ${ctx.member.memberId},
                         ${tx.json({ note: parsed.data })})`);
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/settings');
  return { ok: true };
}
