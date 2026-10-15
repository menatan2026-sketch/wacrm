'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { pgErrorCode, type Tx } from '@ritmo/db';
import { requireManager, type Ctx } from '@/server/context';
import { hashToken, newToken } from '@/server/auth';

export type PeopleError = 'forbidden' | 'invalid' | 'duplicateEmail' | 'emailRequired' | 'error';
export type PeopleResult<T = object> = ({ ok: true } & T) | { ok: false; error: PeopleError };

function fail(err: unknown): { ok: false; error: PeopleError } {
  const code = pgErrorCode(err);
  if (code === '42501') return { ok: false, error: 'forbidden' };
  if (code === '23505') return { ok: false, error: 'duplicateEmail' };
  if (code === '23514' || code === '22P02' || code === '23503') return { ok: false, error: 'invalid' };
  console.error(err);
  return { ok: false, error: 'error' };
}

const optional = (s: z.ZodString) => z.union([z.literal(''), s]).transform((v) => (v === '' ? null : v));

const memberInput = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60),
  email: optional(z.string().trim().toLowerCase().email().max(200)),
  phone: optional(z.string().trim().regex(/^\+?[0-9 -]{6,20}$/)),
  positionId: optional(z.string().uuid()),
  locationId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'manager', 'employee']),
  rate: z.coerce.number().min(0).max(10_000).optional(),
  contractHours: z.coerce.number().min(0).max(80).optional(),
  worksOn: z.enum(['site', 'computer', 'both']),
});
export type MemberInput = z.input<typeof memberInput>;

async function savePay(tx: Tx, ctx: Ctx, memberId: string, rate: number | undefined) {
  if (rate === undefined) return;
  await tx`
    insert into ritmo.member_pay (org_id, member_id, hourly_rate_minor)
    values (${ctx.member.orgId}, ${memberId}, ${Math.round(rate * 100)})
    on conflict (member_id) do update set hourly_rate_minor = excluded.hourly_rate_minor, updated_at = now()`;
}

export async function createMember(input: MemberInput): Promise<PeopleResult<{ id: string }>> {
  const ctx = await requireManager();
  const parsed = memberInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const d = parsed.data;
  try {
    const id = await ctx.db(async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into ritmo.members (org_id, first_name, last_name, email, phone, role, position_id, primary_location_id,
                                   works_on, contract_hours_week, avatar_color)
        values (${ctx.member.orgId}, ${d.firstName}, ${d.lastName}, ${d.email}, ${d.phone}, ${d.role}, ${d.positionId},
                ${d.locationId}, ${d.worksOn}, ${d.contractHours ?? null},
                ${(['green', 'sun', 'sky', 'clay', 'stone'] as const)[Math.floor(Math.random() * 5)]!})
        returning id`;
      await tx`insert into ritmo.member_locations (org_id, member_id, location_id) values (${ctx.member.orgId}, ${row!.id}, ${d.locationId})`;
      await savePay(tx, ctx, row!.id, d.rate);
      await tx`select ritmo.audit(${ctx.member.orgId}, 'member.create', 'member', ${row!.id}, ${tx.json({ role: d.role })})`;
      return row!.id;
    });
    revalidatePath('/people');
    return { ok: true, id };
  } catch (err) {
    return fail(err);
  }
}

export async function updateMember(memberId: string, input: MemberInput): Promise<PeopleResult> {
  const ctx = await requireManager();
  const parsed = memberInput.safeParse(input);
  if (!z.string().uuid().safeParse(memberId).success || !parsed.success) return { ok: false, error: 'invalid' };
  const d = parsed.data;
  try {
    await ctx.db(async (tx) => {
      const rows = await tx`
        update ritmo.members
        set first_name = ${d.firstName}, last_name = ${d.lastName}, email = ${d.email}, phone = ${d.phone},
            role = ${d.role}, position_id = ${d.positionId}, primary_location_id = ${d.locationId},
            works_on = ${d.worksOn}, contract_hours_week = ${d.contractHours ?? null}
        where id = ${memberId} and org_id = ${ctx.member.orgId}
        returning id`;
      // RLS hides rows this manager may not touch: no row means no permission.
      if (!rows.length) throw Object.assign(new Error('not allowed'), { code: '42501' });
      await tx`
        insert into ritmo.member_locations (org_id, member_id, location_id)
        values (${ctx.member.orgId}, ${memberId}, ${d.locationId}) on conflict do nothing`;
      await savePay(tx, ctx, memberId, d.rate);
      await tx`select ritmo.audit(${ctx.member.orgId}, 'member.update', 'member', ${memberId}, ${tx.json({ role: d.role })})`;
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/people');
  return { ok: true };
}

/** Creates a one-time invite link (stored hashed, valid 14 days). */
export async function createInvite(memberId: string): Promise<PeopleResult<{ link: string }>> {
  const ctx = await requireManager();
  if (!z.string().uuid().safeParse(memberId).success) return { ok: false, error: 'invalid' };
  const token = newToken();
  try {
    await ctx.db(async (tx) => {
      const [m] = await tx<{ email: string | null; user_id: string | null }[]>`
        select email, user_id from ritmo.members where id = ${memberId} and org_id = ${ctx.member.orgId}`;
      if (!m || m.user_id) throw Object.assign(new Error('not allowed'), { code: '42501' });
      await tx`
        insert into ritmo.invitations (org_id, member_id, token_hash, created_by)
        values (${ctx.member.orgId}, ${memberId}, ${hashToken(token)}, ${ctx.member.memberId})`;
      await tx`select ritmo.audit(${ctx.member.orgId}, 'invitation.create', 'member', ${memberId})`;
    });
  } catch (err) {
    return fail(err);
  }
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3100';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  revalidatePath('/people');
  return { ok: true, link: `${proto}://${host}/invite/${token}` };
}
