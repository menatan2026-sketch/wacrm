import { createHash } from "node:crypto";
import { schema, eq } from "@mfg/db";
import type { Actor, Ctx } from "../shared/context";
import { authorize } from "../modules/identity/rbac";
import { audit } from "./audit";

export const FLAG_KEYS = [
  "AI_INTAKE",
  "AUTO_PRICING",
  "AUTO_ROUTING",
  "AUTOMATED_QC",
  "B2B_SUBSCRIPTIONS",
  "ADVANCED_MODE",
  "STEP_UPLOADS",
  "SMS_NOTIFICATIONS",
] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

type FlagRow = typeof schema.featureFlags.$inferSelect;

/** Stable 0–99 bucket so a user sees the same variant across requests. */
export function bucket(key: string, subject: string): number {
  return createHash("sha256").update(`${key}:${subject}`).digest().readUInt32BE(0) % 100;
}

export function evaluateFlag(row: FlagRow | undefined, actor: Actor): boolean {
  if (!row || !row.enabled) return false;
  const r = row.rollout ?? {};
  const hasTargeting = r.roles?.length || r.userIds?.length || r.percentage !== undefined;
  if (!hasTargeting) return true;
  if (actor.kind === "system") return true;
  if (actor.kind !== "user") return r.percentage === 100;
  if (r.userIds?.includes(actor.userId)) return true;
  if (r.roles?.some((role) => actor.roles.some((g) => g.role === role))) return true;
  return r.percentage !== undefined && bucket(row.key, actor.userId) < r.percentage;
}

const CACHE_MS = 30_000;
let cache: { at: number; rows: Map<string, FlagRow> } | undefined;

export async function isEnabled(ctx: Ctx, key: FlagKey): Promise<boolean> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const rows = await ctx.db.select().from(schema.featureFlags);
    cache = { at: Date.now(), rows: new Map(rows.map((r) => [r.key, r])) };
  }
  return evaluateFlag(cache.rows.get(key), ctx.actor);
}

export function invalidateFlagCache(): void {
  cache = undefined;
}

export async function listFlags(ctx: Ctx) {
  authorize(ctx.actor, "flags.manage");
  return ctx.db.select().from(schema.featureFlags).orderBy(schema.featureFlags.key);
}

export async function setFlag(
  ctx: Ctx,
  key: FlagKey,
  enabled: boolean,
  reason: string,
): Promise<void> {
  if (ctx.actor.kind !== "system") authorize(ctx.actor, "flags.manage");
  const [before] = await ctx.db
    .select()
    .from(schema.featureFlags)
    .where(eq(schema.featureFlags.key, key));
  await ctx.db
    .update(schema.featureFlags)
    .set({ enabled, updatedBy: ctx.actor.kind === "user" ? ctx.actor.userId : null })
    .where(eq(schema.featureFlags.key, key));
  await audit(ctx, {
    action: "flag.update",
    resourceType: "feature_flag",
    resourceId: key,
    before,
    after: { enabled },
    reason,
  });
  invalidateFlagCache();
}
