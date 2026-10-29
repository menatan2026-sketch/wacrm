import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, type Actor, type Ctx, type UserActor } from "@mfg/core";
import type { Surface } from "@mfg/db";
import { deps } from "./platform";

const secure = () => (process.env.APP_URL ?? "").startsWith("https://");
/** Host-only cookies per surface; `__Host-` prefix whenever served over HTTPS (SECURITY §2). */
export const sessionCookie = (surface: Surface) => `${secure() ? "__Host-" : ""}mfg_${surface === "customer" ? "c" : surface === "supplier" ? "s" : "a"}`;
export const ANON_COOKIE = "mfg_anon";

export const SURFACE_PATH: Record<Surface, string> = { customer: "", supplier: "/partners", admin: "/ops" };

export const getActor = cache(async (surface: Surface): Promise<UserActor | null> => {
  const jar = await cookies();
  return auth.resolveSession(deps(), jar.get(sessionCookie(surface))?.value, surface);
});

/** Signed-in actor for a surface, or a redirect to its sign-in page. Staff must have passed MFA. */
export async function requireActor(surface: Surface, locale: string, next?: string): Promise<UserActor> {
  const actor = await getActor(surface);
  const base = `/${locale}${SURFACE_PATH[surface]}`;
  if (!actor) redirect(`${base}/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (surface === "admin" && !actor.mfaVerified) redirect(`${base}/mfa`);
  return actor;
}

export async function guestOrUser(): Promise<Actor> {
  const user = await getActor("customer");
  if (user) return user;
  const anon = (await cookies()).get(ANON_COOKIE)?.value ?? null;
  return { kind: "guest", anonKey: anon };
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0",
    userAgent: h.get("user-agent") ?? undefined,
    requestId: h.get("x-request-id") ?? undefined,
  };
}

export async function ctxFor(actor: Actor): Promise<Ctx> {
  const d = deps();
  return { db: d.db, actor, clock: d.clock, requestId: (await requestMeta()).requestId };
}

export async function setSessionCookie(surface: Surface, token: string, expires: Date) {
  (await cookies()).set(sessionCookie(surface), token, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", expires });
}

export async function clearSessionCookie(surface: Surface) {
  (await cookies()).delete(sessionCookie(surface));
}
