import { schema, uuidv7, and, desc, eq, inArray, sql } from "@mfg/db";
import type { Deps } from "../../deps";
import { audit } from "../../platform/audit";
import { publish } from "../../platform/outbox";
import { track } from "../../platform/analytics";
import { SYSTEM, type Ctx } from "../../shared/context";
import { DomainError, forbidden, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { authorize, can, requireUser } from "../identity/rbac";
import { lockOrder, systemHold, transitionOrder } from "../orders/service";
import { activeRuleSet } from "../pricing/service";
import { currentQuote } from "../quotes/service";
import { taxFromGross } from "../../shared/money";
import type { PaymentWebhookEvent } from "../../ports";

/** Refunds above this need a FINANCE_ADMIN (refund.approve) — SECURITY §3 separation of duties. */
export const REFUND_APPROVAL_THRESHOLD_MINOR = 50_000;

export const addressSchemaFields = ["recipientName", "phone", "line1", "line2", "city", "postalCode", "notes"] as const;
export interface AddressInput {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode?: string;
  notes?: string;
}

/**
 * Begin checkout for the order's current quote. The amount always comes from the quote snapshot;
 * the client never sends one. Idempotent per key: a double click returns the same payment.
 */
export async function startCheckout(d: Deps, ctx: Ctx, orderId: string, input: { address: AddressInput; idempotencyKey: string; locale: string }) {
  const user = requireUser(ctx.actor);
  const created = await inTx(ctx, async (ctx) => {
    const [existing] = await ctx.db.select().from(schema.payments).where(eq(schema.payments.idempotencyKey, input.idempotencyKey));
    if (existing) {
      if (existing.orderId !== orderId) throw new DomainError("common.idempotency_conflict", 409);
      return { payment: existing, isNew: false };
    }
    const order = await lockOrder(ctx, orderId);
    if (order.customerUserId !== user.userId) throw notFound("order");
    const quote = await currentQuote(ctx, orderId);
    if (!quote || quote.quote.status !== "ready" || !["QUOTE_READY", "PAYMENT_PENDING"].includes(order.status)) throw new DomainError("quotes.not_payable", 409);
    if (quote.quote.expiresAt <= ctx.clock.now()) throw new DomainError("quotes.expired", 409);
    const addressId = uuidv7();
    await ctx.db.insert(schema.addresses).values({ id: addressId, userId: user.userId, ...input.address, line2: input.address.line2 ?? null, postalCode: input.address.postalCode ?? null, notes: input.address.notes ?? null });
    // Only one open payment per order: cancel abandoned ones so a late webhook can't double-charge.
    await ctx.db.update(schema.payments).set({ status: "CANCELLED" }).where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.status, "PENDING")));
    const [payment] = await ctx.db
      .insert(schema.payments)
      .values({ id: uuidv7(), orderId, quoteId: quote.quote.id, provider: d.payments.name, amountMinor: quote.snapshot.totalMinor, currency: quote.snapshot.currency, idempotencyKey: input.idempotencyKey })
      .returning();
    await transitionOrder(ctx, orderId, "checkout_started", { patch: { shipToAddressId: addressId } });
    await track(ctx, "checkout_started", { totalMinor: quote.snapshot.totalMinor }, { orderId });
    return { payment: payment!, isNew: true, orderNumber: order.orderNumber };
  });
  if (!created.isNew && created.payment.checkoutUrl) return { paymentId: created.payment.id, checkoutUrl: created.payment.checkoutUrl };
  const session = await d.payments.createPayment({
    paymentId: created.payment.id,
    amountMinor: created.payment.amountMinor,
    currency: created.payment.currency,
    description: `Order ${"orderNumber" in created ? created.orderNumber : orderId}`,
    locale: input.locale,
    returnUrl: `${d.appUrl}/${input.locale}/orders/${orderId}`,
    idempotencyKey: input.idempotencyKey,
  });
  await d.db.update(schema.payments).set({ providerRef: session.providerRef, checkoutUrl: session.checkoutUrl }).where(eq(schema.payments.id, created.payment.id));
  return { paymentId: created.payment.id, checkoutUrl: session.checkoutUrl };
}

/**
 * Verified, de-duplicated webhook processing. Returns "duplicate" for replays, "invalid" for bad
 * signatures. A captured amount that differs from the quote puts the order on hold for finance.
 */
export async function handlePaymentWebhook(d: Deps, rawBody: string, headers: Record<string, string | undefined>): Promise<"processed" | "duplicate" | "invalid" | "ignored"> {
  const event = d.payments.parseWebhook(rawBody, headers);
  if (!event) {
    await d.db.insert(schema.inboundWebhooks).values({ id: uuidv7(), provider: d.payments.name, providerEventId: `invalid-${uuidv7()}`, signatureValid: false, payload: { length: rawBody.length }, status: "rejected" });
    return "invalid";
  }
  const ctx: Ctx = { db: d.db, actor: SYSTEM, clock: d.clock };
  return inTx(ctx, async (ctx) => {
    const inserted = await ctx.db
      .insert(schema.inboundWebhooks)
      .values({ id: uuidv7(), provider: d.payments.name, providerEventId: event.providerEventId, signatureValid: true, payload: event as unknown as Record<string, unknown> })
      .onConflictDoNothing()
      .returning({ id: schema.inboundWebhooks.id });
    if (!inserted.length) return "duplicate";
    const outcome = await applyPaymentEvent(d, ctx, event);
    await ctx.db.update(schema.inboundWebhooks).set({ status: outcome, processedAt: ctx.clock.now() }).where(eq(schema.inboundWebhooks.id, inserted[0]!.id));
    return outcome === "ignored" ? "ignored" : "processed";
  });
}

async function applyPaymentEvent(d: Deps, ctx: Ctx, event: PaymentWebhookEvent): Promise<"processed" | "ignored"> {
  const [payment] = await ctx.db.select().from(schema.payments).where(and(eq(schema.payments.provider, d.payments.name), eq(schema.payments.providerRef, event.providerRef))).for("update");
  if (!payment) return "ignored";
  if (event.type === "payment.failed") {
    if (payment.status !== "PENDING") return "ignored";
    await ctx.db.update(schema.payments).set({ status: "FAILED" }).where(eq(schema.payments.id, payment.id));
    await ctx.db.insert(schema.paymentTransactions).values({ id: uuidv7(), paymentId: payment.id, kind: "failed", amountMinor: 0, providerEventId: event.providerEventId });
    const [order] = await ctx.db.select().from(schema.orders).where(eq(schema.orders.id, payment.orderId));
    if (order?.status === "PAYMENT_PENDING") await transitionOrder(ctx, payment.orderId, "payment_failed", { trigger: "system" });
    return "processed";
  }
  if (event.type !== "payment.captured" || payment.status === "CAPTURED") return "ignored";
  await ctx.db.update(schema.payments).set({ status: "CAPTURED" }).where(eq(schema.payments.id, payment.id));
  await ctx.db.insert(schema.paymentTransactions).values({ id: uuidv7(), paymentId: payment.id, kind: "capture", amountMinor: event.amountMinor, providerEventId: event.providerEventId });
  if (event.amountMinor !== payment.amountMinor || event.currency !== payment.currency || payment.status === "CANCELLED") {
    await systemHold(ctx, payment.orderId, "payment_amount_mismatch");
    await audit(ctx, { action: "payment.amount_mismatch", resourceType: "payment", resourceId: payment.id, after: { expected: payment.amountMinor, received: event.amountMinor } });
    return "processed";
  }
  const order = await lockOrder(ctx, payment.orderId);
  const quote = await currentQuote(ctx, payment.orderId);
  const rules = await activeRuleSet(ctx);
  const leadDays = rules.rules.urgencyLeadDays[order.urgencyTier as "standard" | "fast" | "urgent"];
  const shipDate = addBusinessDays(ctx.clock.now(), leadDays);
  await ctx.db.update(schema.quotes).set({ status: "accepted", acceptedAt: ctx.clock.now() }).where(eq(schema.quotes.id, payment.quoteId));
  await transitionOrder(ctx, payment.orderId, "payment_succeeded", {
    trigger: "system",
    patch: { promisedShipDate: shipDate.toISOString().slice(0, 10), promisedDeliveryDate: addBusinessDays(shipDate, 2).toISOString().slice(0, 10) },
  });
  if (quote) await issueDocument(d, ctx, payment.orderId, "receipt", quote.snapshot.subtotalNetMinor, quote.snapshot.taxMinor, quote.snapshot.totalMinor, quote.snapshot.currency, order.orderNumber);
  await publish(ctx, "order.paid", { orderId: payment.orderId });
  await publish(ctx, "notify.customer", { orderId: payment.orderId, template: "payment_succeeded" });
  await track(ctx, "payment_success", { amountMinor: event.amountMinor }, { orderId: payment.orderId });
  return "processed";
}

/** Sun–Thu business days (Israeli week). Holidays come from a business calendar later (KNOWN_ISSUES). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 5 && d.getUTCDay() !== 6) added++;
  }
  return d;
}

async function issueDocument(d: Deps, ctx: Ctx, orderId: string, kind: "receipt" | "credit_note", netMinor: number, taxMinor: number, totalMinor: number, currency: string, orderNumber: string) {
  const seq = Number(((await ctx.db.execute(sql`SELECT nextval('invoice_number_seq') AS n`)).rows[0] as { n: string }).n);
  const doc = await d.invoices.issue({ kind, sequence: seq, orderNumber });
  await ctx.db.insert(schema.invoices).values({ id: uuidv7(), orderId, kind, documentNumber: doc.documentNumber, provider: d.invoices.name, netMinor, taxMinor, totalMinor, currency, payload: { orderNumber } });
}

export async function paymentsForOrder(ctx: Ctx, orderId: string) {
  return ctx.db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)).orderBy(desc(schema.payments.createdAt));
}

/**
 * Request a refund. Amounts within the threshold are executed directly by anyone with
 * refund.request + refund.approve or by the system (cancellation policy); larger ones wait for
 * finance approval.
 */
export async function requestRefund(d: Deps, ctx: Ctx, orderId: string, input: { amountMinor: number; reasonCode: string; note?: string }) {
  if (ctx.actor.kind !== "system") authorize(ctx.actor, "refund.request");
  const refund = await inTx(ctx, async (ctx) => {
    const [payment] = await ctx.db
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.orderId, orderId), inArray(schema.payments.status, ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"])))
      .for("update");
    if (!payment) throw notFound("payment");
    const pending = await ctx.db.select({ s: sql<number>`coalesce(sum(amount_minor),0)` }).from(schema.refunds).where(and(eq(schema.refunds.paymentId, payment.id), inArray(schema.refunds.status, ["requested", "approved"])));
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0 || input.amountMinor + payment.refundedMinor + Number(pending[0]?.s ?? 0) > payment.amountMinor) {
      throw new DomainError("payments.refund_exceeds_captured", 422);
    }
    const autoApprove = ctx.actor.kind === "system" || can(ctx.actor, "refund.approve") || input.amountMinor <= REFUND_APPROVAL_THRESHOLD_MINOR;
    const [row] = await ctx.db
      .insert(schema.refunds)
      .values({ id: uuidv7(), paymentId: payment.id, amountMinor: input.amountMinor, reasonCode: input.reasonCode, note: input.note ?? null, status: autoApprove ? "approved" : "requested", requestedBy: ctx.actor.kind === "user" ? ctx.actor.userId : null, approvedBy: autoApprove && ctx.actor.kind === "user" ? ctx.actor.userId : null })
      .returning();
    await audit(ctx, { action: "refund.requested", resourceType: "refund", resourceId: row!.id, after: { amountMinor: input.amountMinor, autoApprove }, reason: input.reasonCode });
    return row!;
  });
  if (refund.status === "approved") await executeRefund(d, ctx, refund.id);
  return refund.id;
}

export async function approveRefund(d: Deps, ctx: Ctx, refundId: string) {
  authorize(ctx.actor, "refund.approve");
  const user = requireUser(ctx.actor);
  await inTx(ctx, async (ctx) => {
    const [refund] = await ctx.db.select().from(schema.refunds).where(eq(schema.refunds.id, refundId)).for("update");
    if (!refund || refund.status !== "requested") throw new DomainError("common.conflict", 409);
    if (refund.requestedBy === user.userId) throw forbidden({ reason: "second_person_required" });
    await ctx.db.update(schema.refunds).set({ status: "approved", approvedBy: user.userId }).where(eq(schema.refunds.id, refundId));
    await audit(ctx, { action: "refund.approved", resourceType: "refund", resourceId: refundId });
  });
  await executeRefund(d, ctx, refundId);
}

async function executeRefund(d: Deps, outer: Ctx, refundId: string) {
  const ctx: Ctx = { ...outer, actor: outer.actor.kind === "guest" ? SYSTEM : outer.actor };
  const [refund] = await d.db.select().from(schema.refunds).where(eq(schema.refunds.id, refundId));
  const [payment] = await d.db.select().from(schema.payments).where(eq(schema.payments.id, refund!.paymentId));
  let refundRef: string;
  try {
    ({ refundRef } = await d.payments.refundPayment({ providerRef: payment!.providerRef!, amountMinor: refund!.amountMinor, idempotencyKey: `refund:${refundId}` }));
  } catch (err) {
    await d.db.update(schema.refunds).set({ status: "failed", note: String(err).slice(0, 300) }).where(eq(schema.refunds.id, refundId));
    return;
  }
  await inTx({ ...ctx, db: d.db, inTransaction: false }, async (ctx) => {
    const [p] = await ctx.db.select().from(schema.payments).where(eq(schema.payments.id, payment!.id)).for("update");
    const refunded = p!.refundedMinor + refund!.amountMinor;
    await ctx.db.update(schema.payments).set({ refundedMinor: refunded, status: refunded >= p!.amountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED" }).where(eq(schema.payments.id, p!.id));
    await ctx.db.update(schema.refunds).set({ status: "completed", providerRef: refundRef, completedAt: ctx.clock.now() }).where(eq(schema.refunds.id, refundId));
    await ctx.db.insert(schema.paymentTransactions).values({ id: uuidv7(), paymentId: p!.id, kind: "refund", amountMinor: refund!.amountMinor, providerEventId: refundRef });
    const [order] = await ctx.db.select().from(schema.orders).where(eq(schema.orders.id, p!.orderId));
    const [snapshot] = await ctx.db.select({ taxRateBps: schema.quoteSnapshots.taxRateBps }).from(schema.quoteSnapshots).where(eq(schema.quoteSnapshots.quoteId, p!.quoteId));
    const tax = taxFromGross(refund!.amountMinor, snapshot?.taxRateBps ?? 0);
    const net = refund!.amountMinor - tax;
    await issueDocument(d, ctx, p!.orderId, "credit_note", net, refund!.amountMinor - net, refund!.amountMinor, p!.currency, order!.orderNumber);
    if (refunded >= p!.amountMinor && (order!.status === "CANCELLED" || order!.status === "DISPUTED")) {
      await transitionOrder({ ...ctx, actor: SYSTEM }, p!.orderId, "refund_completed", { trigger: "system" });
    }
    await publish(ctx, "notify.customer", { orderId: p!.orderId, template: "refund_completed", vars: { amountMinor: refund!.amountMinor } });
    await track(ctx, "refund_completed", { amountMinor: refund!.amountMinor }, { orderId: p!.orderId });
  });
}

export async function pendingRefunds(ctx: Ctx) {
  authorize(ctx.actor, "payment.read.any");
  return ctx.db
    .select({ refund: schema.refunds, orderId: schema.payments.orderId })
    .from(schema.refunds)
    .innerJoin(schema.payments, eq(schema.payments.id, schema.refunds.paymentId))
    .where(eq(schema.refunds.status, "requested"));
}

/**
 * Customer or staff cancellation per stage (UX_ARCHITECTURE §8): before payment immediately;
 * after payment and before supplier acceptance with an automatic full refund.
 */
export async function cancelOrder(d: Deps, ctx: Ctx, orderId: string, reason: string) {
  const result = await inTx(ctx, async (ctx) => {
    const order = await lockOrder(ctx, orderId);
    if (["DRAFT", "REQUIREMENTS_PENDING", "REVIEW_REQUIRED", "DESIGN_REQUIRED", "DESIGN_IN_PROGRESS", "DESIGN_APPROVAL", "QUOTE_READY", "PAYMENT_PENDING"].includes(order.status)) {
      await transitionOrder(ctx, orderId, "cancel", { reason });
      await ctx.db.update(schema.payments).set({ status: "CANCELLED" }).where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.status, "PENDING")));
      return { refund: false };
    }
    if (["PAID", "ROUTING", "SUPPLIER_ASSIGNED", "SUPPLIER_ACCEPTED"].includes(order.status)) {
      await transitionOrder(ctx, orderId, "cancel_paid", { reason });
      await ctx.db.update(schema.jobOffers).set({ status: "withdrawn" }).where(and(eq(schema.jobOffers.status, "pending"), sql`${schema.jobOffers.jobId} IN (SELECT id FROM production_jobs WHERE order_id = ${orderId})`));
      await ctx.db.update(schema.productionJobs).set({ status: "CANCELLED" }).where(and(eq(schema.productionJobs.orderId, orderId), inArray(schema.productionJobs.status, ["OFFERED", "ACCEPTED"])));
      return { refund: true };
    }
    throw new DomainError("orders.not_cancellable", 409);
  });
  if (result.refund) {
    const [payment] = await d.db.select().from(schema.payments).where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.status, "CAPTURED")));
    if (payment) await requestRefund(d, { ...ctx, actor: SYSTEM }, orderId, { amountMinor: payment.amountMinor - payment.refundedMinor, reasonCode: "cancelled_before_production" });
  }
}

export async function documentsForOrder(ctx: Ctx, orderId: string) {
  return ctx.db.select().from(schema.invoices).where(eq(schema.invoices.orderId, orderId)).orderBy(schema.invoices.issuedAt);
}

/** Development payment page support: look up a payment by its provider reference. */
export async function findPaymentByRef(d: Deps, providerRef: string) {
  const [row] = await d.db.select().from(schema.payments).where(and(eq(schema.payments.provider, d.payments.name), eq(schema.payments.providerRef, providerRef)));
  return row ?? null;
}
