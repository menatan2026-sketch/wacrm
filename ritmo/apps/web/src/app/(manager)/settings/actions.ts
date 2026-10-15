'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { pgErrorCode } from '@ritmo/db';
import { requireCtx, requireManager } from '@/server/context';

export type SettingsResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' | 'error' };

function fail(err: unknown): SettingsResult {
  const code = pgErrorCode(err);
  if (code === '42501') return { ok: false, error: 'forbidden' };
  if (code === '23514' || code === '22P02') return { ok: false, error: 'invalid' };
  console.error(err);
  return { ok: false, error: 'error' };
}

const notAllowed = () => Object.assign(new Error('not allowed'), { code: '42501' });

const profileInput = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60),
  phone: z.union([z.literal(''), z.string().trim().regex(/^\+?[0-9 -]{6,20}$/)]),
});

export async function updateProfile(input: z.input<typeof profileInput>): Promise<SettingsResult> {
  const ctx = await requireCtx();
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const d = parsed.data;
  try {
    await ctx.db(async (tx) => {
      await tx`
        update ritmo.members set first_name = ${d.firstName}, last_name = ${d.lastName}, phone = ${d.phone || null}
        where id = ${ctx.member.memberId}`;
      await tx`select ritmo.audit(${ctx.member.orgId}, 'profile.update', 'member', ${ctx.member.memberId})`;
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function updateOrgName(name: string): Promise<SettingsResult> {
  const ctx = await requireManager();
  const parsed = z.string().trim().min(1).max(120).safeParse(name);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  try {
    await ctx.db(async (tx) => {
      const rows = await tx`update ritmo.organizations set name = ${parsed.data} where id = ${ctx.member.orgId} returning id`;
      if (!rows.length) throw notAllowed();
      await tx`select ritmo.audit(${ctx.member.orgId}, 'org.update', 'organization', ${ctx.member.orgId})`;
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

const locationInput = z.object({
  id: z.string().uuid(),
  budget: z.union([z.literal(''), z.coerce.number().min(0).max(100_000_000)]),
  radius: z.coerce.number().int().min(25).max(5000),
});

export async function updateLocation(input: z.input<typeof locationInput>): Promise<SettingsResult> {
  const ctx = await requireManager();
  const parsed = locationInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const d = parsed.data;
  try {
    await ctx.db(async (tx) => {
      const rows = await tx`
        update ritmo.locations
        set weekly_budget_minor = ${d.budget === '' ? null : Math.round(d.budget * 100)}, geofence_radius_m = ${d.radius}
        where id = ${d.id} and org_id = ${ctx.member.orgId} returning id`;
      if (!rows.length) throw notAllowed();
      await tx`select ritmo.audit(${ctx.member.orgId}, 'location.update', 'location', ${d.id},
                                  ${tx.json({ budget: d.budget === '' ? null : d.budget, radius: d.radius })})`;
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/settings');
  revalidatePath('/overview');
  revalidatePath('/schedule');
  return { ok: true };
}
