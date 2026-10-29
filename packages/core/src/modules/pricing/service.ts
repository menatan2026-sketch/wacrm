import { schema, uuidv7, and, desc, eq, gte, isNull, lte, or, sql } from "@mfg/db";
import { audit } from "../../platform/audit";
import type { Ctx } from "../../shared/context";
import { DomainError, invalid, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { authorize, requireUser } from "../identity/rbac";
import { pricingRulesSchema, type PricingRules } from "./rules";

export async function activeRuleSet(ctx: Ctx, processCode = "FDM"): Promise<{ id: string; version: number; rules: PricingRules }> {
  const [row] = await ctx.db
    .select()
    .from(schema.pricingRuleSets)
    .where(and(eq(schema.pricingRuleSets.processCode, processCode), eq(schema.pricingRuleSets.status, "active")));
  if (!row) throw new DomainError("pricing.no_active_rules", 409);
  return { id: row.id, version: row.version, rules: pricingRulesSchema.parse(row.rules) };
}

export async function vatRateBps(ctx: Ctx, country = "IL"): Promise<number> {
  const today = ctx.clock.now().toISOString().slice(0, 10);
  const [row] = await ctx.db
    .select()
    .from(schema.taxRates)
    .where(and(eq(schema.taxRates.country, country), eq(schema.taxRates.kind, "vat"), lte(schema.taxRates.effectiveFrom, today), or(isNull(schema.taxRates.effectiveTo), gte(schema.taxRates.effectiveTo, today))))
    .orderBy(desc(schema.taxRates.effectiveFrom))
    .limit(1);
  if (!row) throw new DomainError("pricing.no_active_rules", 409, { missing: "vat" });
  return row.rateBps;
}

export async function listRuleSets(ctx: Ctx) {
  authorize(ctx.actor, "pricing.rules.manage");
  return ctx.db.select().from(schema.pricingRuleSets).orderBy(desc(schema.pricingRuleSets.version));
}

/** Create a new draft version. Rules are validated; nothing changes until a second person activates it. */
export async function createRuleSetDraft(ctx: Ctx, rules: unknown, processCode = "FDM") {
  authorize(ctx.actor, "pricing.rules.manage");
  const parsed = pricingRulesSchema.safeParse(rules);
  if (!parsed.success) throw invalid("pricing.invalid_rules", { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  return inTx(ctx, async (ctx) => {
    const res = await ctx.db.execute(sql`SELECT coalesce(max(version), 0) AS max FROM pricing_rule_sets WHERE process_code = ${processCode}`);
    const max = Number((res.rows[0] as { max: number } | undefined)?.max ?? 0);
    const id = uuidv7();
    await ctx.db.insert(schema.pricingRuleSets).values({ id, processCode, version: max + 1, status: "draft", rules: parsed.data, createdBy: requireUser(ctx.actor).userId });
    await audit(ctx, { action: "pricing.rules_drafted", resourceType: "pricing_rule_set", resourceId: id, after: parsed.data });
    return id;
  });
}

/** Activation requires pricing.rules.activate and a different person than the author (SECURITY §3). */
export async function activateRuleSet(ctx: Ctx, ruleSetId: string, reason: string) {
  authorize(ctx.actor, "pricing.rules.activate");
  const user = requireUser(ctx.actor);
  return inTx(ctx, async (ctx) => {
    const [rs] = await ctx.db.select().from(schema.pricingRuleSets).where(eq(schema.pricingRuleSets.id, ruleSetId)).for("update");
    if (!rs || rs.status !== "draft") throw notFound("pricing_rule_set");
    if (rs.createdBy === user.userId) throw new DomainError("pricing.activation_requires_second_person", 409);
    await ctx.db
      .update(schema.pricingRuleSets)
      .set({ status: "retired" })
      .where(and(eq(schema.pricingRuleSets.processCode, rs.processCode), eq(schema.pricingRuleSets.status, "active")));
    await ctx.db.update(schema.pricingRuleSets).set({ status: "active", activatedBy: user.userId, activatedAt: ctx.clock.now() }).where(eq(schema.pricingRuleSets.id, ruleSetId));
    await audit(ctx, { action: "pricing.rules_activated", resourceType: "pricing_rule_set", resourceId: ruleSetId, after: { version: rs.version }, reason });
  });
}
