import "server-only";
import { notFound } from "next/navigation";
import { rbac, type Ctx, type UserActor } from "@mfg/core";
import { ctxFor, requireActor } from "./session";

/** Signed-in partner plus the supplier they act for (first supplier-scoped grant). */
export async function partnerContext(
  locale: string,
  next?: string,
): Promise<{ actor: UserActor; ctx: Ctx; supplierId: string }> {
  const actor = await requireActor("supplier", locale, next);
  const supplierId = rbac.supplierScopes(actor)[0];
  if (!supplierId) notFound();
  return { actor, ctx: await ctxFor(actor), supplierId };
}
