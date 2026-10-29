"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, drafts, SYSTEM } from "@mfg/core";
import type { Surface } from "@mfg/db";
import { run } from "@/lib/actions";
import { deps } from "@/lib/platform";
import { ANON_COOKIE, getActor, requestMeta, sessionCookie, setSessionCookie, clearSessionCookie, SURFACE_PATH } from "@/lib/session";

const emailSchema = z.email().max(254);

export async function requestCodeAction(email: string, locale: string) {
  return run(async () => {
    const { ip } = await requestMeta();
    await auth.requestLoginCode(deps(), { email: emailSchema.parse(email.trim()), locale, ip });
  });
}

/** Only same-surface relative paths are accepted as post-login destinations (open-redirect guard). */
function safeNext(next: string | undefined, locale: string, surface: Surface): string {
  const base = `/${locale}${SURFACE_PATH[surface]}`;
  if (next && next.startsWith(`/${locale}`) && !next.startsWith("//") && !next.includes("\\")) return next;
  return base || `/${locale}`;
}

export async function verifyCodeAction(input: { email: string; code: string; surface: Surface; locale: string; next?: string; inviteToken?: string }) {
  const result = await run(async () => {
    const { ip, userAgent } = await requestMeta();
    const d = deps();
    const r = await auth.verifyLoginCode(d, {
      email: emailSchema.parse(input.email.trim()),
      code: z.string().regex(/^\d{6}$/).parse(input.code.trim()),
      surface: input.surface,
      locale: input.locale,
      ip,
      userAgent,
      inviteToken: input.inviteToken,
    });
    await setSessionCookie(input.surface, r.sessionToken, r.expiresAt);
    if (input.surface === "customer") {
      const anon = (await cookies()).get(ANON_COOKIE)?.value;
      if (anon) await drafts.claimDrafts({ db: d.db, actor: SYSTEM, clock: d.clock }, anon, r.userId);
    }
    return r.mfa;
  });
  if (!result.ok) return result;
  if (input.surface === "admin") redirect(`/${input.locale}/ops/mfa`);
  redirect(safeNext(input.next, input.locale, input.surface));
}

export async function signOutAction(surface: Surface, locale: string) {
  const token = (await cookies()).get(sessionCookie(surface))?.value;
  if (token) await auth.revokeSession(deps(), token);
  await clearSessionCookie(surface);
  redirect(`/${locale}${SURFACE_PATH[surface]}`);
}

export async function verifyMfaAction(code: string, locale: string) {
  const result = await run(async () => {
    const actor = await getActor("admin");
    if (!actor) throw new Error("no session");
    await auth.verifyMfa(deps(), actor, z.string().regex(/^\d{6}$/).parse(code.trim()));
  });
  if (!result.ok) return result;
  redirect(`/${locale}/ops`);
}
