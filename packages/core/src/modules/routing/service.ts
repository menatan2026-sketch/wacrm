import { schema, uuidv7, and, desc, eq, gt, inArray, lt, sql } from "@mfg/db";
import type { Deps } from "../../deps";
import { audit } from "../../platform/audit";
import { isEnabled } from "../../platform/flags";
import { publish } from "../../platform/outbox";
import { track } from "../../platform/analytics";
import { SYSTEM, type Ctx } from "../../shared/context";
import { DomainError, forbidden, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { authorize, can, requireUser } from "../identity/rbac";
import { lockOrder, systemHold, transitionOrder } from "../orders/service";
import { partSummaries } from "../production/summary";
import { currentQuote } from "../quotes/service";
import {
  DEFAULT_ROUTING_WEIGHTS,
  rankSuppliers,
  type RoutingSupplier,
  type RoutingWeights,
} from "./engine";

const HOUR = 3600 * 1000;
const OFFER_HOURS = { standard: 4, fast: 2, urgent: 1 } as const;
const MAX_OFFER_ATTEMPTS = 5;

async function routingConfig(ctx: Ctx): Promise<{ id: string | null; weights: RoutingWeights }> {
  const [rs] = await ctx.db
    .select()
    .from(schema.routingRuleSets)
    .where(eq(schema.routingRuleSets.status, "active"))
    .orderBy(desc(schema.routingRuleSets.version))
    .limit(1);
  return {
    id: rs?.id ?? null,
    weights: { ...DEFAULT_ROUTING_WEIGHTS, ...(rs?.weights ?? {}) } as RoutingWeights,
  };
}

/** Supplier payout for this order: the supplier's own rate card scaling or the quote's expected payout. */
function payoutFor(supplier: typeof schema.suppliers.$inferSelect, expected: number): number {
  const factor = Number((supplier.payoutCard as { factor?: number } | null)?.factor ?? 1);
  return Math.round(expected * factor);
}

/** Business days (Sun–Thu) between now and the promised ship date, at least 1. */
export function workingDaysUntil(from: Date, to: Date): number {
  let days = 0;
  const d = new Date(from);
  while (d < to) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 5 && wd !== 6) days++;
  }
  return Math.max(days, 1);
}

async function loadCandidates(ctx: Ctx, expectedPayout: number): Promise<RoutingSupplier[]> {
  const suppliers = await ctx.db.select().from(schema.suppliers);
  const machines = await ctx.db.select().from(schema.machines);
  const mm = await ctx.db.select().from(schema.machineMaterials);
  const load = await ctx.db.execute(
    sql`SELECT supplier_id, coalesce(sum(estimated_minutes),0) AS minutes FROM production_jobs WHERE status IN ('ACCEPTED','IN_PRODUCTION') GROUP BY supplier_id`,
  );
  const committed = new Map(
    (load.rows as { supplier_id: string; minutes: string }[]).map((r) => [
      r.supplier_id,
      Number(r.minutes),
    ]),
  );
  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    leadTimeDays: s.leadTimeDays,
    stats: s.stats,
    committedMinutes: committed.get(s.id) ?? 0,
    payoutMinor: payoutFor(s, expectedPayout),
    machines: machines
      .filter((m) => m.supplierId === s.id)
      .map((m) => ({
        status: m.status,
        buildMm: [m.buildXMm, m.buildYMm, m.buildZMm] as [number, number, number],
        dailyCapacityMinutes: m.dailyCapacityMinutes,
        materialVariantIds: mm.filter((x) => x.machineId === m.id).map((x) => x.materialVariantId),
      })),
  }));
}

async function declinedSuppliers(ctx: Ctx, orderId: string): Promise<string[]> {
  const rows = await ctx.db
    .select({ supplierId: schema.jobOffers.supplierId })
    .from(schema.jobOffers)
    .innerJoin(schema.productionJobs, eq(schema.productionJobs.id, schema.jobOffers.jobId))
    .where(
      and(
        eq(schema.productionJobs.orderId, orderId),
        inArray(schema.jobOffers.status, ["declined", "expired", "withdrawn"]),
      ),
    );
  return [...new Set(rows.map((r) => r.supplierId))];
}

/**
 * Rank suppliers for a paid order and store the explanation. With AUTO_ROUTING the top candidate
 * receives an offer immediately; otherwise ops confirms the proposal (manual fallback).
 */
export async function proposeRouting(
  d: Deps,
  outer: Ctx,
  orderId: string,
): Promise<{ decisionId: string; topSupplierId: string | null; autoAssigned: boolean }> {
  const ctx: Ctx = { ...outer, actor: outer.actor.kind === "user" ? outer.actor : SYSTEM };
  return inTx(ctx, async (ctx) => {
    let order = await lockOrder(ctx, orderId);
    if (order.status === "PAID")
      order = await transitionOrder(ctx, orderId, "routing_started", {
        trigger: ctx.actor.kind === "system" ? "system" : "staff",
      });
    if (order.status !== "ROUTING") throw new DomainError("orders.invalid_transition", 409);
    const quote = await currentQuote(ctx, orderId);
    if (!quote) throw notFound("quote");
    const [item] = await ctx.db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));
    if (!item?.materialVariantId) throw new DomainError("routing.no_candidates", 409);
    const bbox = snapshotItems(quote.snapshot.inputs)[0]?.bboxMm ?? [0, 0, 0];
    const due = order.promisedShipDate
      ? new Date(order.promisedShipDate)
      : new Date(ctx.clock.now().getTime() + 7 * 24 * HOUR);
    const cfg = await routingConfig(ctx);
    const candidates = rankSuppliers(
      {
        orderId,
        materialVariantId: item.materialVariantId,
        bboxMm: bbox,
        printMinutes: estimatedMinutes(quote.snapshot.inputs),
        workingDaysUntilDue: workingDaysUntil(ctx.clock.now(), due),
        excludedSupplierIds: await declinedSuppliers(ctx, orderId),
      },
      await loadCandidates(ctx, quote.snapshot.expectedPayoutMinor),
      cfg.weights,
    );
    const top = candidates.find((c) => !c.excludedReason) ?? null;
    const decisionId = uuidv7();
    await ctx.db.insert(schema.routingDecisions).values({
      id: decisionId,
      orderId,
      ruleSetId: cfg.id,
      candidates,
      chosenSupplierId: top?.supplierId ?? null,
      mode: "proposal",
    });
    if (!top) {
      await systemHold(ctx, orderId, "routing_no_candidates");
      await publish(ctx, "routing.failed", { orderId });
      return { decisionId, topSupplierId: null, autoAssigned: false };
    }
    if (await isEnabled(ctx, "AUTO_ROUTING")) {
      await offerToSupplier(d, ctx, orderId, top.supplierId, "auto");
      return { decisionId, topSupplierId: top.supplierId, autoAssigned: true };
    }
    return { decisionId, topSupplierId: top.supplierId, autoAssigned: false };
  });
}

interface SnapshotItem {
  bboxMm: [number, number, number];
  quantity: number;
}

/** Items as recorded in the quote snapshot (auto quotes store them directly, manual ones under engineInput). */
function snapshotItems(inputs: Record<string, unknown>): SnapshotItem[] {
  const direct = (inputs as { items?: SnapshotItem[] }).items;
  const manual = (inputs as { engineInput?: { items?: SnapshotItem[] } }).engineInput?.items;
  return direct ?? manual ?? [];
}

/** Machine minutes for the whole order, from the engine estimates frozen in the quote snapshot. */
function estimatedMinutes(inputs: Record<string, unknown>): number {
  const estimates = (inputs as { estimates?: { printMinutes: number }[] }).estimates ?? [];
  return snapshotItems(inputs).reduce(
    (sum, item, i) => sum + (estimates[i]?.printMinutes ?? 60) * item.quantity,
    0,
  );
}

/**
 * Create (or reuse) the production job and send a time-limited offer to one supplier. Staff may
 * pick any active supplier (manual override, reason required).
 */
export async function offerToSupplier(
  d: Deps,
  ctx: Ctx,
  orderId: string,
  supplierId: string,
  mode: "auto" | "manual_confirmed" | "manual_override",
  reason?: string,
) {
  if (mode !== "auto") {
    authorize(ctx.actor, "routing.manage");
    if (mode === "manual_override" && !reason?.trim())
      throw new DomainError("common.validation", 422, { field: "reason" });
  }
  return inTx(ctx, async (ctx) => {
    const order = await lockOrder(ctx, orderId);
    if (order.status !== "ROUTING") throw new DomainError("orders.invalid_transition", 409);
    const [supplier] = await ctx.db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, supplierId));
    if (!supplier || supplier.status !== "active")
      throw new DomainError("routing.no_candidates", 409);
    const quote = await currentQuote(ctx, orderId);
    if (!quote) throw notFound("quote");
    const attempts = await ctx.db
      .select({ n: sql<number>`count(*)` })
      .from(schema.jobOffers)
      .innerJoin(schema.productionJobs, eq(schema.productionJobs.id, schema.jobOffers.jobId))
      .where(eq(schema.productionJobs.orderId, orderId));
    if (mode === "auto" && Number(attempts[0]?.n ?? 0) >= MAX_OFFER_ATTEMPTS) {
      await systemHold(ctx, orderId, "routing_max_attempts");
      return null;
    }
    let [job] = await ctx.db
      .select()
      .from(schema.productionJobs)
      .where(
        and(
          eq(schema.productionJobs.orderId, orderId),
          eq(schema.productionJobs.status, "OFFERED"),
        ),
      );
    const due = order.promisedShipDate
      ? new Date(`${order.promisedShipDate}T15:00:00Z`)
      : new Date(ctx.clock.now().getTime() + 5 * 24 * HOUR);
    if (!job) {
      [job] = await ctx.db
        .insert(schema.productionJobs)
        .values({
          id: uuidv7(),
          orderId,
          status: "OFFERED",
          attemptNo: 1,
          currency: quote.snapshot.currency,
          dueAt: due,
          estimatedMinutes: estimatedMinutes(quote.snapshot.inputs),
        })
        .returning();
    }
    const payout = payoutFor(supplier, quote.snapshot.expectedPayoutMinor);
    const offerId = uuidv7();
    const expiresAt = new Date(
      ctx.clock.now().getTime() + OFFER_HOURS[order.urgencyTier as keyof typeof OFFER_HOURS] * HOUR,
    );
    await ctx.db
      .insert(schema.jobOffers)
      .values({ id: offerId, jobId: job!.id, supplierId, payoutMinor: payout, expiresAt });
    if (mode !== "auto") {
      await ctx.db.insert(schema.routingDecisions).values({
        id: uuidv7(),
        orderId,
        candidates: [],
        chosenSupplierId: supplierId,
        mode,
        actorId: requireUser(ctx.actor).userId,
        reason: reason ?? null,
      });
      await track(ctx, "manual_action_taken", { action: `routing.${mode}` }, { orderId });
    }
    await transitionOrder(ctx, orderId, "supplier_assigned", {
      trigger: ctx.actor.kind === "system" ? "system" : "staff",
      patch: { assignedSupplierId: supplierId },
    });
    await audit(ctx, {
      action: "routing.offer_sent",
      resourceType: "job_offer",
      resourceId: offerId,
      after: { supplierId, payout, mode },
      reason,
    });
    await publish(ctx, "notify.supplier", { offerId, template: "offer_received" });
    await track(ctx, "supplier_assigned", { mode }, { orderId });
    return offerId;
  });
}

export async function supplierOffers(ctx: Ctx, supplierId: string) {
  if (!can(ctx.actor, "job.read.own", { supplierId })) throw forbidden();
  const rows = await ctx.db
    .select({
      offer: schema.jobOffers,
      job: schema.productionJobs,
      order: { orderNumber: schema.orders.orderNumber, urgencyTier: schema.orders.urgencyTier },
    })
    .from(schema.jobOffers)
    .innerJoin(schema.productionJobs, eq(schema.productionJobs.id, schema.jobOffers.jobId))
    .innerJoin(schema.orders, eq(schema.orders.id, schema.productionJobs.orderId))
    .where(
      and(
        eq(schema.jobOffers.supplierId, supplierId),
        eq(schema.jobOffers.status, "pending"),
        gt(schema.jobOffers.expiresAt, ctx.clock.now()),
      ),
    )
    .orderBy(schema.jobOffers.expiresAt);
  const summaries = await partSummaries(
    ctx,
    rows.map((r) => r.job.orderId),
  );
  return rows.map((r) => ({ ...r, part: summaries.get(r.job.orderId)! }));
}

/** Supplier accepts or declines. Acceptance freezes the payout; a decline re-routes automatically. */
export async function respondToOffer(
  d: Deps,
  ctx: Ctx,
  offerId: string,
  response: { accept: boolean; declineReason?: string },
) {
  const user = requireUser(ctx.actor);
  const result = await inTx(ctx, async (ctx) => {
    const [offer] = await ctx.db
      .select()
      .from(schema.jobOffers)
      .where(eq(schema.jobOffers.id, offerId))
      .for("update");
    if (!offer) throw notFound("offer");
    if (!can(user, "job.respond", { supplierId: offer.supplierId })) throw forbidden();
    if (offer.status !== "pending" || offer.expiresAt <= ctx.clock.now())
      throw new DomainError("jobs.offer_not_pending", 409);
    const [job] = await ctx.db
      .select()
      .from(schema.productionJobs)
      .where(eq(schema.productionJobs.id, offer.jobId))
      .for("update");
    if (!job || job.status !== "OFFERED") throw new DomainError("jobs.offer_not_pending", 409);
    const now = ctx.clock.now();
    if (response.accept) {
      await ctx.db
        .update(schema.jobOffers)
        .set({ status: "accepted", respondedAt: now, respondedBy: user.userId })
        .where(eq(schema.jobOffers.id, offerId));
      await ctx.db
        .update(schema.productionJobs)
        .set({
          status: "ACCEPTED",
          supplierId: offer.supplierId,
          payoutMinor: offer.payoutMinor,
          acceptedAt: now,
        })
        .where(eq(schema.productionJobs.id, job.id));
      await transitionOrder(ctx, job.orderId, "supplier_accepted", { trigger: "system" });
      await audit(ctx, {
        action: "job.accepted",
        resourceType: "production_job",
        resourceId: job.id,
        after: { payoutMinor: offer.payoutMinor },
      });
      return { orderId: job.orderId, rerouted: false };
    }
    await ctx.db
      .update(schema.jobOffers)
      .set({
        status: "declined",
        respondedAt: now,
        respondedBy: user.userId,
        declineReason: response.declineReason?.slice(0, 200) ?? null,
      })
      .where(eq(schema.jobOffers.id, offerId));
    await transitionOrder(ctx, job.orderId, "offer_lapsed", {
      trigger: "system",
      patch: { assignedSupplierId: null },
    });
    await audit(ctx, {
      action: "job.declined",
      resourceType: "job_offer",
      resourceId: offerId,
      reason: response.declineReason,
    });
    await track(
      ctx,
      "offer_declined",
      { reason: response.declineReason ?? null },
      { orderId: job.orderId },
    );
    return { orderId: job.orderId, rerouted: true };
  });
  if (result.rerouted) await proposeRouting(d, { ...ctx, actor: SYSTEM }, result.orderId);
  return result;
}

/** Scheduler: expire unanswered offers and re-route (SLA, MASTER_PLAN §15). */
export async function expireOffers(d: Deps, ctx: Ctx): Promise<number> {
  const due = await ctx.db
    .select({ offer: schema.jobOffers, orderId: schema.productionJobs.orderId })
    .from(schema.jobOffers)
    .innerJoin(schema.productionJobs, eq(schema.productionJobs.id, schema.jobOffers.jobId))
    .where(
      and(eq(schema.jobOffers.status, "pending"), lt(schema.jobOffers.expiresAt, ctx.clock.now())),
    );
  const sys = { ...ctx, actor: SYSTEM };
  for (const { offer, orderId } of due) {
    await inTx(sys, async (tx) => {
      await tx.db
        .update(schema.jobOffers)
        .set({ status: "expired" })
        .where(eq(schema.jobOffers.id, offer.id));
      await transitionOrder(tx, orderId, "offer_lapsed", {
        trigger: "system",
        patch: { assignedSupplierId: null },
      });
    });
    await proposeRouting(d, sys, orderId);
  }
  return due.length;
}

export async function routingDecisions(ctx: Ctx, orderId: string) {
  authorize(ctx.actor, "order.read.any");
  return ctx.db
    .select()
    .from(schema.routingDecisions)
    .where(eq(schema.routingDecisions.orderId, orderId))
    .orderBy(desc(schema.routingDecisions.createdAt));
}
