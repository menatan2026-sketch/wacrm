import 'server-only';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { asApp } from '@ritmo/db';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export const SESSION_COOKIE = 'ritmo_session';
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1 };

// ---------------------------------------------------------------- passwords
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, n, r, p, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Minimum bar: 10+ characters. Length beats composition rules (NIST 800-63B). */
export function passwordProblem(password: string): 'tooShort' | 'tooLong' | null {
  if (password.length < 10) return 'tooShort';
  if (password.length > 200) return 'tooLong';
  return null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest();

// ---------------------------------------------------------------- sessions
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  locale: 'he' | 'en';
  theme: 'system' | 'light' | 'dark';
}

/** Creates a session and sets the cookie. Only the token's hash is stored. */
export async function startSession(userId: string, userAgent: string | null) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await asApp(
    (tx) => tx`insert into ritmo_auth.sessions (user_id, token_hash, user_agent, expires_at)
               values (${userId}, ${sha256(token)}, ${userAgent?.slice(0, 300) ?? null}, ${expires})`,
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

/** The signed-in user for this request, or null. Cached per request. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await asApp(
    (tx) => tx<{ id: string; email: string; full_name: string; locale: 'he' | 'en'; theme: SessionUser['theme']; stale: boolean }[]>`
      select u.id, u.email, u.full_name, u.locale, u.theme, s.last_seen_at < now() - interval '1 hour' as stale
      from ritmo_auth.sessions s join ritmo_auth.users u on u.id = s.user_id
      where s.token_hash = ${sha256(token)} and s.expires_at > now()`,
  );
  const row = rows[0];
  if (!row) return null;
  if (row.stale) {
    await asApp((tx) => tx`update ritmo_auth.sessions set last_seen_at = now() where token_hash = ${sha256(token)}`);
  }
  return { id: row.id, email: row.email, fullName: row.full_name, locale: row.locale, theme: row.theme };
});

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await asApp((tx) => tx`delete from ritmo_auth.sessions where token_hash = ${sha256(token)}`);
  }
  jar.delete(SESSION_COOKIE);
}

// ---------------------------------------------------------------- login throttling
const MAX_FAILURES = 8;
const WINDOW_MINUTES = 15;

/** True when this email has too many recent failures. */
export async function isThrottled(email: string): Promise<boolean> {
  const [row] = await asApp(
    (tx) => tx<{ failures: number }[]>`
      select count(*)::int as failures from ritmo_auth.login_attempts
      where email = ${email} and not succeeded and created_at > now() - make_interval(mins => ${WINDOW_MINUTES})`,
  );
  return (row?.failures ?? 0) >= MAX_FAILURES;
}

export async function recordAttempt(email: string, succeeded: boolean) {
  await asApp((tx) => tx`insert into ritmo_auth.login_attempts (email, succeeded) values (${email}, ${succeeded})`);
}

export function hashToken(token: string): Buffer {
  return sha256(token);
}

export function newToken(): string {
  return randomBytes(24).toString('base64url');
}
