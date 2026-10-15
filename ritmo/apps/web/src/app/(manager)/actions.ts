'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { pgErrorCode } from '@ritmo/db';
import { requireManager } from '@/server/context';

export type ActionResult = { ok: true } | { ok: false; error: 'forbidden' | 'error' | string };

function fail(err: unknown): ActionResult {
  const code = pgErrorCode(err);
  if (code === '42501') return { ok: false, error: 'forbidden' };
  console.error(err);
  return { ok: false, error: 'error' };
}

const id = z.string().uuid();

export async function decideRequest(requestId: string, approve: boolean): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!id.safeParse(requestId).success) return { ok: false, error: 'error' };
  try {
    await ctx.db((tx) => tx`select ritmo.decide_shift_request(${requestId}, ${approve})`);
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/overview');
  revalidatePath('/schedule');
  return { ok: true };
}

export async function resolveAnomaly(anomalyId: string): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!id.safeParse(anomalyId).success) return { ok: false, error: 'error' };
  try {
    await ctx.db(async (tx) => {
      const rows = await tx`
        update ritmo.anomalies set status = 'resolved', resolved_by = ${ctx.member.memberId}, resolved_at = now()
        where id = ${anomalyId} and status = 'open' returning org_id`;
      if (rows.length) await tx`select ritmo.audit(${ctx.member.orgId}, 'anomaly.resolve', 'anomaly', ${anomalyId})`;
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/overview');
  revalidatePath('/time');
  return { ok: true };
}
