'use server';

import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { asApp, asUser, pgErrorCode } from '@ritmo/db';
import {
  endSession, hashPassword, hashToken, isThrottled, passwordProblem, recordAttempt, startSession, verifyPassword,
} from './auth';
import { LOCALE_COOKIE, THEME_COOKIE } from '@/i18n/locale';

export interface FormState {
  error?: string;
  fields?: Record<string, string>;
}

const emailSchema = z.string().trim().toLowerCase().email().max(200);

/** Only allow redirects to our own paths. */
function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === 'string' ? next : '';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

async function applyUserPrefs(locale: string, theme: string) {
  const jar = await cookies();
  const opts = { path: '/', sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 365 };
  jar.set(LOCALE_COOKIE, locale, opts);
  jar.set(THEME_COOKIE, theme, opts);
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(form.get('email'));
  const password = String(form.get('password') ?? '');
  if (!email.success || !password) return { error: 'invalid', fields: { email: String(form.get('email') ?? '') } };

  if (await isThrottled(email.data)) return { error: 'throttled', fields: { email: email.data } };

  const [user] = await asApp(
    (tx) => tx<{ id: string; password_hash: string | null; locale: string; theme: string }[]>`
      select id, password_hash, locale, theme from ritmo_auth.users where email = ${email.data}`,
  );
  // Verify even when the user doesn't exist, so timing doesn't reveal accounts.
  const ok = await verifyPassword(password, user?.password_hash ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AA==');
  await recordAttempt(email.data, Boolean(user && ok));
  if (!user || !ok) return { error: 'invalid', fields: { email: email.data } };

  await startSession(user.id, (await headers()).get('user-agent'));
  await applyUserPrefs(user.locale, user.theme);
  redirect(safeNext(form.get('next')));
}

const signUpSchema = z.object({
  orgName: z.string().trim().min(1).max(120),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60),
  email: emailSchema,
  password: z.string(),
});

function slugify(name: string) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  return `${base || 'team'}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(['orgName', 'firstName', 'lastName', 'email', 'password'].map((k) => [k, String(form.get(k) ?? '')]));
  const fields = { orgName: raw.orgName!, firstName: raw.firstName!, lastName: raw.lastName!, email: raw.email! };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.path[0];
    return { error: issue === 'email' ? 'badEmail' : 'required', fields };
  }
  const problem = passwordProblem(parsed.data.password);
  if (problem) return { error: problem, fields };

  const locale = (await cookies()).get(LOCALE_COOKIE)?.value === 'en' ? 'en' : 'he';
  let userId: string;
  try {
    const hash = await hashPassword(parsed.data.password);
    const [row] = await asApp(
      (tx) => tx<{ id: string }[]>`
        insert into ritmo_auth.users (email, password_hash, full_name, locale)
        values (${parsed.data.email}, ${hash}, ${`${parsed.data.firstName} ${parsed.data.lastName}`.trim()}, ${locale})
        returning id`,
    );
    userId = row!.id;
  } catch (err) {
    if (pgErrorCode(err) === '23505') return { error: 'emailTaken', fields };
    throw err;
  }
  await asUser(userId, (tx) =>
    tx`select ritmo.create_organization(${parsed.data.orgName}, ${slugify(parsed.data.orgName)},
         ${parsed.data.firstName}, ${parsed.data.lastName}, ${locale})`,
  );
  await startSession(userId, (await headers()).get('user-agent'));
  redirect('/overview');
}

export async function acceptInvite(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const tokenHash = hashToken(token);
  const [invite] = await asApp(
    (tx) => tx<{ org_name: string; first_name: string; email: string | null }[]>`select * from ritmo.invitation_preview(${tokenHash})`,
  );
  if (!invite?.email) return { error: 'inviteInvalid' };

  const hash = await hashPassword(password);
  const userId = await asApp(async (tx) => {
    const [existing] = await tx<{ id: string }[]>`select id from ritmo_auth.users where email = ${invite.email}`;
    if (existing) return null; // existing accounts must sign in first; never take over an account by invite
    const [u] = await tx<{ id: string }[]>`
      insert into ritmo_auth.users (email, password_hash, full_name) values (${invite.email}, ${hash}, ${invite.first_name})
      returning id`;
    await tx`select ritmo.accept_invitation(${tokenHash}, ${u!.id})`;
    return u!.id;
  });
  if (!userId) return { error: 'emailTaken' };
  await startSession(userId, (await headers()).get('user-agent'));
  redirect('/');
}

export async function signOut() {
  await endSession();
  redirect('/login');
}
