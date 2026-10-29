import "server-only";
import type { Ctx, UserActor } from "@mfg/core";
import { ctxFor, requireActor } from "./session";

/** Staff context for the ops surface; requireActor enforces session + MFA. */
export async function opsContext(locale: string, next?: string): Promise<{ actor: UserActor; ctx: Ctx }> {
  const actor = await requireActor("admin", locale, next);
  return { actor, ctx: await ctxFor(actor) };
}
