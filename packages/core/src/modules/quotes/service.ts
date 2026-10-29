import { schema, uuidv7, and, eq, inArray, lt, type QuoteLine } from "@mfg/db";
import type { Deps } from "../../deps";
import { audit } from "../../platform/audit";
import { isEnabled } from "../../platform/flags";
import { publish } from "../../platform/outbox";
import { track } from "../../platform/analytics";
import { SYSTEM, type Ctx } from "../../shared/context";
import { DomainError, notFound } from "../../shared/errors";
import { applyBps, roundToStep, taxFromGross } from "../../shared/money";
import { inTx } from "../../shared/tx";
import { getVariant } from "../catalog/service";
import { getAnalysis, scaledGeometry } from "../geometry/service";
import { authorize, requireUser } from "../identity/rbac";
import { lockOrder, transitionOrder } from "../orders/service";
import { calculatePrice, PRICING_ENGINE_VERSION, snapshotHash, type PriceBreakdown, type PricingInput } from "../pricing/engine";
import { activeRuleSet, vatRateBps } from "../pricing/service";
import { deriveRequirements, recommendMaterials } from "../requirements/rules";

const DAY = 24 * 3600 * 1000;

export async function currentQuote(ctx: Ctx, orderId: string) {
  const [row] = await ctx.db
    .select({ quote: schema.quotes, snapshot: schema.quoteSnapshots })
    .from(schema.quotes)
    .innerJoin(schema.quoteSnapshots, eq(schema.quoteSnapshots.quoteId, schema.quotes.id))
    .innerJoin(schema.orders, eq(schema.orders.currentQuoteId, schema.quotes.id))
    .where(eq(schema.orders.id, orderId));
  return row ?? null;
}

/** Build engine input for an order item from its stored choices and geometry. */
export async function pricingInputForOrder(ctx: Ctx, orderId: string): Promise<{ input: Omit<PricingInput, "taxRateBps">; reasons: string[] }> {
  const [order] = await ctx.db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!order) throw notFound("order");
  const items = await ctx.db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  const reasons: string[] = [];
  const priced: PricingInput["items"] = [];
  for (const item of items) {
    reasons.push(...deriveRequirements(item.usage).reviewReasons);
    if (!item.fileId) {
      reasons.push("no_model_file");
      continue;
    }
    const analysis = await getAnalysis(ctx, item.fileId);
    if (!analysis || analysis.status !== "succeeded") {
      reasons.push(analysis?.status === "failed" ? `geometry_${analysis.failureCode}` : "geometry_pending");
      continue;
    }
    if (!analysis.isWatertight) reasons.push("mesh_not_watertight");
    if (!item.materialVariantId) {
      reasons.push("no_material_fits");
      continue;
    }
    const { material } = await getVariant(ctx, item.materialVariantId);
    const g = scaledGeometry(analysis, (item.unitsConfirmed as "mm" | "in") ?? "mm", item.scale);
    priced.push({ ...g, materialCode: material.code, densityGCm3: material.densityGCm3, qualityProfile: item.qualityProfileCode ?? "standard", quantity: item.quantity });
  }
  return { input: { items: priced, urgency: order.urgencyTier as PricingInput["urgency"], includeShipping: true }, reasons };
}

async function writeQuote(
  ctx: Ctx,
  orderId: string,
  q: { mode: "auto" | "manual"; ruleSetId: string | null; validityDays: number; breakdown: PriceBreakdown; inputs: Record<string, unknown>; taxRateBps: number; computedTotalMinor: number; overrideReason?: string },
) {
  const now = ctx.clock.now();
  const quoteId = uuidv7();
  await ctx.db
    .update(schema.quotes)
    .set({ status: "superseded" })
    .where(and(eq(schema.quotes.orderId, orderId), eq(schema.quotes.status, "ready")));
  await ctx.db.insert(schema.quotes).values({
    id: quoteId,
    orderId,
    status: "ready",
    mode: q.mode,
    ruleSetId: q.ruleSetId,
    overrideReason: q.overrideReason ?? null,
    createdBy: ctx.actor.kind === "user" ? ctx.actor.userId : null,
    expiresAt: new Date(now.getTime() + q.validityDays * DAY),
  });
  const b = q.breakdown;
  await ctx.db.insert(schema.quoteSnapshots).values({
    quoteId,
    inputs: { ...q.inputs, estimates: b.items.map((i) => ({ massG: Math.round(i.massG * 10) / 10, printMinutes: i.printMinutes })) },
    lines: b.lines,
    subtotalNetMinor: b.subtotalNetMinor,
    taxMinor: b.taxMinor,
    totalMinor: b.totalMinor,
    computedTotalMinor: q.computedTotalMinor,
    expectedPayoutMinor: b.expectedPayoutMinor,
    expectedMarginMinor: b.expectedMarginMinor,
    taxRateBps: q.taxRateBps,
    currency: b.currency,
    engineVersion: b.engineVersion,
    hash: snapshotHash({ inputs: q.inputs, breakdown: b }),
  });
  await ctx.db.update(schema.orders).set({ currentQuoteId: quoteId }).where(eq(schema.orders.id, orderId));
  await audit(ctx, { action: `quote.created_${q.mode}`, resourceType: "quote", resourceId: quoteId, after: { totalMinor: b.totalMinor, computedTotalMinor: q.computedTotalMinor }, reason: q.overrideReason });
  await track(ctx, "quote_created", { mode: q.mode, totalMinor: b.totalMinor }, { orderId });
  return quoteId;
}

/**
 * Automatic quote for an order in REQUIREMENTS_PENDING. Any guard (pricing, requirements,
 * geometry, flag off) routes the order to REVIEW_REQUIRED with stored reasons instead.
 */
export async function autoQuote(_d: Deps, outer: Ctx, orderId: string): Promise<"quoted" | "review"> {
  const ctx: Ctx = { ...outer, actor: SYSTEM };
  return inTx(ctx, async (ctx) => {
    const order = await lockOrder(ctx, orderId);
    const { input, reasons } = await pricingInputForOrder(ctx, orderId);
    if (!(await isEnabled(ctx, "AUTO_PRICING"))) reasons.push("auto_pricing_disabled");
    let breakdown: PriceBreakdown | null = null;
    let rules;
    let taxRateBps = 0;
    if (input.items.length) {
      rules = await activeRuleSet(ctx);
      taxRateBps = await vatRateBps(ctx);
      breakdown = calculatePrice({ ...input, taxRateBps }, rules.rules);
      reasons.push(...breakdown.reviewReasons);
    }
    const unique = [...new Set(reasons)];
    if (unique.length || !breakdown || !rules) {
      await ctx.db.update(schema.orders).set({ reviewReasons: unique }).where(eq(schema.orders.id, orderId));
      await transitionOrder(ctx, orderId, "needs_review", { trigger: "system", reason: unique.join(",") });
      return "review";
    }
    await writeQuote(ctx, orderId, { mode: "auto", ruleSetId: rules.id, validityDays: rules.rules.quoteValidityDays, breakdown, inputs: { ...input, taxRateBps, ruleSetVersion: rules.version }, taxRateBps, computedTotalMinor: breakdown.totalMinor });
    const event = order.status === "QUOTE_READY" ? "requote" : "auto_quote_ready";
    await transitionOrder(ctx, orderId, event, { trigger: "system", patch: { reviewReasons: [] } });
    await publish(ctx, "notify.customer", { orderId, template: "quote_ready" });
    return "quoted";
  });
}

export interface ManualQuoteInput {
  /** Net amount for manufacturing (overrides the computed price when set). */
  manufacturingNetMinor?: number;
  designFeeNetMinor?: number;
  includeShipping: boolean;
  urgency?: "standard" | "fast" | "urgent";
  materialVariantId?: string;
  qualityProfile?: string;
  reason: string;
}

/**
 * Staff quote (Flow B/C, reviewed Flow A, design fees). The engine's cost-plus result is stored
 * alongside any override so the margin impact of the manual decision stays visible.
 */
export async function manualQuote(_d: Deps, ctx: Ctx, orderId: string, m: ManualQuoteInput): Promise<string> {
  authorize(ctx.actor, "quote.manual");
  requireUser(ctx.actor);
  if (!m.reason.trim()) throw new DomainError("common.validation", 422, { field: "reason" });
  return inTx(ctx, async (ctx) => {
    const order = await lockOrder(ctx, orderId);
    if (m.materialVariantId || m.qualityProfile) {
      await ctx.db
        .update(schema.orderItems)
        .set({ ...(m.materialVariantId ? { materialVariantId: m.materialVariantId } : {}), ...(m.qualityProfile ? { qualityProfileCode: m.qualityProfile } : {}) })
        .where(eq(schema.orderItems.orderId, orderId));
    }
    if (m.urgency) await ctx.db.update(schema.orders).set({ urgencyTier: m.urgency }).where(eq(schema.orders.id, orderId));
    const rules = await activeRuleSet(ctx);
    const taxRateBps = await vatRateBps(ctx);
    const { input } = await pricingInputForOrder(ctx, orderId);
    const computed = input.items.length ? calculatePrice({ ...input, urgency: m.urgency ?? input.urgency, taxRateBps, designFeeNetMinor: m.designFeeNetMinor }, rules.rules) : null;

    const lines: QuoteLine[] = [];
    const manufacturing = m.manufacturingNetMinor ?? computed?.lines.find((l) => l.kind === "manufacturing")?.amountNetMinor ?? 0;
    if (manufacturing > 0) lines.push({ kind: "manufacturing", labelKey: "quotes.lines.manufacturing", amountNetMinor: manufacturing });
    const urgency = m.urgency ?? (order.urgencyTier as "standard");
    if (rules.rules.urgency[urgency] > 10000 && manufacturing > 0) {
      lines.push({ kind: "urgency", labelKey: `quotes.lines.urgency_${urgency}`, amountNetMinor: applyBps(manufacturing, rules.rules.urgency[urgency] - 10000) });
    }
    if (m.designFeeNetMinor) lines.push({ kind: "design_fee", labelKey: "quotes.lines.design_fee", amountNetMinor: m.designFeeNetMinor });
    if (m.includeShipping) lines.push({ kind: "shipping", labelKey: "quotes.lines.shipping", amountNetMinor: rules.rules.shipping.priceNetMinor });
    if (lines.length === 0) throw new DomainError("common.validation", 422, { field: "lines" });

    const rawNet = lines.reduce((s, l) => s + l.amountNetMinor, 0);
    const totalMinor = roundToStep(applyBps(rawNet, 10000 + taxRateBps), rules.rules.grossRoundingMinor);
    const taxMinor = taxFromGross(totalMinor, taxRateBps);
    lines[0]!.amountNetMinor += totalMinor - taxMinor - rawNet;
    const payout = computed?.expectedPayoutMinor ?? 0;
    const breakdown: PriceBreakdown = {
      engineVersion: computed?.engineVersion ?? PRICING_ENGINE_VERSION,
      currency: rules.rules.currency,
      items: computed?.items ?? [],
      lines,
      subtotalNetMinor: totalMinor - taxMinor,
      taxMinor,
      totalMinor,
      expectedPayoutMinor: payout,
      expectedMarginMinor: totalMinor - taxMinor - payout - (m.includeShipping ? rules.rules.shipping.costMinor : 0) - applyBps(totalMinor, rules.rules.paymentFeeBps),
      marginBps: 0,
      leadDays: rules.rules.urgencyLeadDays[urgency],
      reviewReasons: [],
    };
    breakdown.marginBps = breakdown.subtotalNetMinor ? Math.round((breakdown.expectedMarginMinor / breakdown.subtotalNetMinor) * 10000) : 0;
    const quoteId = await writeQuote(ctx, orderId, {
      mode: "manual",
      ruleSetId: rules.id,
      validityDays: rules.rules.quoteValidityDays,
      breakdown,
      inputs: { manual: m, engineInput: input, taxRateBps },
      taxRateBps,
      computedTotalMinor: computed?.totalMinor ?? totalMinor,
      overrideReason: m.reason,
    });
    const event = order.status === "QUOTE_READY" ? "requote" : "publish_quote";
    await transitionOrder(ctx, orderId, event, { reason: m.reason, patch: { reviewReasons: [] } });
    await publish(ctx, "notify.customer", { orderId, template: "quote_ready" });
    return quoteId;
  });
}

/** Customer changes quantity/urgency/color on a ready quote → a new snapshot with current rules. */
export async function requoteWithOptions(d: Deps, ctx: Ctx, orderId: string, opts: { quantity?: number; urgency?: "standard" | "fast" | "urgent"; materialVariantId?: string }) {
  const user = requireUser(ctx.actor);
  return inTx(ctx, async (ctx) => {
    const order = await lockOrder(ctx, orderId);
    if (order.customerUserId !== user.userId) throw notFound("order");
    if (order.status !== "QUOTE_READY") throw new DomainError("orders.invalid_transition", 409);
    const [item] = await ctx.db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    if (!item) throw notFound("order_item");
    if (opts.materialVariantId) {
      const { material } = await getVariant(ctx, opts.materialVariantId);
      const all = await ctx.db.select().from(schema.materials).where(eq(schema.materials.status, "active"));
      const fits = recommendMaterials(all, deriveRequirements(item.usage)).some((m) => m.id === material.id);
      if (!fits) throw new DomainError("common.validation", 422, { field: "materialVariantId" });
    }
    if (opts.quantity !== undefined && (!Number.isInteger(opts.quantity) || opts.quantity < 1 || opts.quantity > 500)) throw new DomainError("common.validation", 422, { field: "quantity" });
    await ctx.db
      .update(schema.orderItems)
      .set({ ...(opts.quantity ? { quantity: opts.quantity } : {}), ...(opts.materialVariantId ? { materialVariantId: opts.materialVariantId } : {}) })
      .where(eq(schema.orderItems.id, item.id));
    if (opts.urgency) await ctx.db.update(schema.orders).set({ urgencyTier: opts.urgency }).where(eq(schema.orders.id, orderId));
    return autoQuote(d, ctx, orderId);
  });
}

/** Scheduler: expire quotes past validity; file-flow orders are re-quoted with current rules. */
export async function expireQuotes(d: Deps, ctx: Ctx): Promise<number> {
  const due = await ctx.db
    .select({ quoteId: schema.quotes.id, orderId: schema.quotes.orderId, flow: schema.orders.flow })
    .from(schema.quotes)
    .innerJoin(schema.orders, eq(schema.orders.currentQuoteId, schema.quotes.id))
    .where(and(eq(schema.quotes.status, "ready"), lt(schema.quotes.expiresAt, ctx.clock.now()), inArray(schema.orders.status, ["QUOTE_READY", "PAYMENT_PENDING"])));
  for (const q of due) {
    await inTx({ ...ctx, actor: SYSTEM }, async (tx) => {
      await tx.db.update(schema.quotes).set({ status: "expired" }).where(eq(schema.quotes.id, q.quoteId));
      await transitionOrder(tx, q.orderId, "quote_expired", { trigger: "system" });
      await track(tx, "quote_expired", {}, { orderId: q.orderId });
    });
    if (q.flow === "file") await autoQuote(d, ctx, q.orderId);
  }
  return due.length;
}

