'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { addDays, weekStart, weekTotals, zonedToUtc } from '@ritmo/core';
import { pgErrorCode, type Tx } from '@ritmo/db';
import { requireManager, type Ctx } from '@/server/context';
import { entriesBetween, toEntry } from '@/server/queries';
import { TZ } from '@/lib/format';
import type { ActionResult } from '../actions';

function fail(err: unknown): ActionResult {
  const code = pgErrorCode(err);
  if (code === '42501') return { ok: false, error: 'forbidden' };
  if (code === '23514') return { ok: false, error: 'invalid' };
  console.error(err);
  return { ok: false, error: 'error' };
}

const uuid = z.string().uuid();
const week = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => weekStart(s) === s);

function revalidate() {
  revalidatePath('/time', 'layout');
  revalidatePath('/overview');
}

/** Approves one member's week with the totals computed now, and audits it. */
async function approveOne(tx: Tx, ctx: Ctx, memberId: string, ws: string) {
  const entries = (await entriesBetween(tx, ctx.member.orgId, ws, addDays(ws, 7))).filter((e) => e.member_id === memberId);
  const t = weekTotals(entries.map(toEntry), ctx.member.policy, TZ);
  const totals = { regular: t.regular, overtime1: t.overtime1, overtime2: t.overtime2, restDay: t.restDay, total: t.total };
  await tx`
    insert into ritmo.timesheet_approvals (org_id, member_id, week_start, status, totals, decided_by)
    values (${ctx.member.orgId}, ${memberId}, ${ws}, 'approved', ${tx.json(totals)}, ${ctx.member.memberId})
    on conflict (org_id, member_id, week_start)
    do update set status = 'approved', totals = excluded.totals, decided_by = excluded.decided_by, decided_at = now(), comment = null`;
  await tx`select ritmo.audit(${ctx.member.orgId}, 'timesheet.approve', 'member', ${memberId}, ${tx.json({ week: ws, ...totals })})`;
}

export async function approveWeek(memberId: string, ws: string): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!uuid.safeParse(memberId).success || !week.safeParse(ws).success) return { ok: false, error: 'error' };
  // The database forbids it too (CHECK decided_by <> member_id); say so in words.
  if (memberId === ctx.member.memberId) return { ok: false, error: 'self' };
  try {
    await ctx.db((tx) => approveOne(tx, ctx, memberId, ws));
  } catch (err) {
    return fail(err);
  }
  revalidate();
  return { ok: true };
}

export type ApproveAllResult = { ok: true; count: number } | { ok: false; error: string };

/** Approves every waiting member of the week with no open issues and no running shift; skips yourself. */
export async function approveAllClean(ws: string, locationId: string | null): Promise<ApproveAllResult> {
  const ctx = await requireManager();
  if (!week.safeParse(ws).success || (locationId !== null && !uuid.safeParse(locationId).success)) return { ok: false, error: 'error' };
  try {
    const count = await ctx.db(async (tx) => {
      const entries = await entriesBetween(tx, ctx.member.orgId, ws, addDays(ws, 7), locationId);
      const ids = [...new Set(entries.map((e) => e.member_id))].filter((id) => id !== ctx.member.memberId);
      if (ids.length === 0) return 0;
      const clean = await tx<{ id: string }[]>`
        select m.id from ritmo.members m
        where m.org_id = ${ctx.member.orgId} and m.id = any(${ids}::uuid[]) and ritmo.can_manage_member(m.org_id, m.id)
          and not exists (select 1 from ritmo.timesheet_approvals ta where ta.member_id = m.id and ta.week_start = ${ws} and ta.status = 'approved')
          and not exists (select 1 from ritmo.time_entries te where te.member_id = m.id and te.ended_at is null
                            and te.work_date >= ${ws} and te.work_date < ${addDays(ws, 7)})
          and not exists (select 1 from ritmo.anomalies a join ritmo.time_entries te on te.id = a.time_entry_id
                            where a.member_id = m.id and a.status = 'open' and te.work_date >= ${ws} and te.work_date < ${addDays(ws, 7)})`;
      for (const { id } of clean) await approveOne(tx, ctx, id, ws);
      return clean.length;
    });
    revalidate();
    return { ok: true, count };
  } catch (err) {
    return fail(err) as ApproveAllResult;
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const editSchema = z.object({
  entryId: uuid,
  start: z.string().regex(TIME),
  end: z.union([z.literal(''), z.string().regex(TIME)]),
  breakMinutes: z.coerce.number().int().min(0).max(600),
  reason: z.string().trim().max(300),
});

export type EditInput = z.input<typeof editSchema>;

/**
 * Corrects a payroll line (time_entries). The original time_events are never
 * touched. Every correction needs a reason, is audited with before/after, and
 * sends an already-approved week back to "waiting".
 */
export async function editEntry(input: EditInput): Promise<ActionResult> {
  const ctx = await requireManager();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'error' };
  const { entryId, start, end, breakMinutes, reason } = parsed.data;
  if (reason.length < 3) return { ok: false, error: 'reasonRequired' };
  try {
    const res = await ctx.db(async (tx) => {
      const [old] = await tx<{ member_id: string; work_date: string; started_at: Date; ended_at: Date | null; break_minutes: number }[]>`
        select member_id, work_date::text as work_date, started_at, ended_at, break_minutes
        from ritmo.time_entries where id = ${entryId} and org_id = ${ctx.member.orgId} and ritmo.can_manage_member(org_id, member_id)`;
      if (!old) return 'forbidden' as const;
      if (old.member_id === ctx.member.memberId) return 'self' as const;
      const startedAt = zonedToUtc(old.work_date, start, TZ);
      let endedAt: Date | null = null;
      if (end !== '') {
        endedAt = zonedToUtc(old.work_date, end, TZ);
        if (endedAt <= startedAt) endedAt = zonedToUtc(addDays(old.work_date, 1), end, TZ); // overnight shift
      } else if (old.ended_at) return 'invalid' as const; // a closed entry can't be reopened here
      if (endedAt && breakMinutes >= Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000)) return 'invalid' as const;
      await tx`
        update ritmo.time_entries
        set started_at = ${startedAt}, ended_at = ${endedAt}, status = ${endedAt ? 'closed' : 'open'},
            break_minutes = ${breakMinutes}, edited_reason = ${reason}, edited_by = ${ctx.member.memberId}
        where id = ${entryId}`;
      const ws = weekStart(old.work_date);
      const reopened = await tx`
        delete from ritmo.timesheet_approvals where member_id = ${old.member_id} and week_start = ${ws} returning id`;
      await tx`select ritmo.audit(${ctx.member.orgId}, 'time_entry.edit', 'time_entry', ${entryId}, ${tx.json({
        reason,
        before: { startedAt: old.started_at.toISOString(), endedAt: old.ended_at?.toISOString() ?? null, breakMinutes: old.break_minutes },
        after: { startedAt: startedAt.toISOString(), endedAt: endedAt?.toISOString() ?? null, breakMinutes },
        approvalReopened: reopened.length > 0,
      })})`;
      return 'ok' as const;
    });
    if (res !== 'ok') return { ok: false, error: res };
  } catch (err) {
    return fail(err);
  }
  revalidate();
  return { ok: true };
}
