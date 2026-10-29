import { schema, and, desc, eq, gte, inArray, sql } from "@mfg/db";
import { queryAudit } from "../../platform/audit";
import type { Ctx } from "../../shared/context";
import { notFound } from "../../shared/errors";
import { authorize, can } from "../identity/rbac";
import { orderHistory, orderMessages } from "../orders/service";
import { paymentsForOrder } from "../payments/service";
import { currentQuote } from "../quotes/service";
import { routingDecisions } from "../routing/service";
import { shipmentsForOrder } from "../shipping/service";

/** Attention queue + headline KPIs for the ops dashboard (UX_ARCHITECTURE §3.3, MASTER_PLAN §20). */
export async function opsDashboard(ctx: Ctx) {
  authorize(ctx.actor, "staff.access");
  const now = ctx.clock.now();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const byStatus = await ctx.db.select({ status: schema.orders.status, n: sql<number>`count(*)::int` }).from(schema.orders).groupBy(schema.orders.status);
  const attention = await ctx.db
    .select({ id: schema.orders.id, orderNumber: schema.orders.orderNumber, status: schema.orders.status, onHold: schema.orders.onHold, holdReason: schema.orders.holdReason, reviewReasons: schema.orders.reviewReasons, statusChangedAt: schema.orders.statusChangedAt, flow: schema.orders.flow })
    .from(schema.orders)
    .where(sql`${schema.orders.onHold} OR ${schema.orders.status} IN ('REVIEW_REQUIRED','ROUTING','QC_PENDING','QC_FAILED','DISPUTED','READY_FOR_SHIPMENT')`)
    .orderBy(schema.orders.statusChangedAt)
    .limit(100);
  const late = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.productionJobs)
    .where(and(inArray(schema.productionJobs.status, ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING"]), sql`${schema.productionJobs.dueAt} < ${now}`));
  const [money] = await ctx.db
    .select({
      revenueToday: sql<number>`coalesce(sum(p.amount_minor) FILTER (WHERE p.updated_at >= ${startOfDay}), 0)::bigint`,
      revenue30: sql<number>`coalesce(sum(s.subtotal_net_minor), 0)::bigint`,
      margin30: sql<number>`coalesce(sum(s.expected_margin_minor), 0)::bigint`,
      paidOrders30: sql<number>`count(distinct o.id)::int`,
    })
    .from(sql`orders o JOIN payments p ON p.order_id = o.id AND p.status IN ('CAPTURED','PARTIALLY_REFUNDED') JOIN quote_snapshots s ON s.quote_id = p.quote_id`)
    .where(gte(sql`o.paid_at`, monthAgo));
  const [funnel] = await ctx.db
    .select({
      quotes: sql<number>`count(*) FILTER (WHERE name = 'quote_created')::int`,
      checkouts: sql<number>`count(*) FILTER (WHERE name = 'checkout_started')::int`,
      payments: sql<number>`count(*) FILTER (WHERE name = 'payment_success')::int`,
      manualActions: sql<number>`count(*) FILTER (WHERE name = 'manual_action_taken')::int`,
      reprints: sql<number>`count(*) FILTER (WHERE name = 'qc_failed')::int`,
      refunds: sql<number>`count(*) FILTER (WHERE name = 'refund_completed')::int`,
    })
    .from(schema.analyticsEvents)
    .where(gte(schema.analyticsEvents.at, monthAgo));
  const failedWebhooks = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(schema.inboundWebhooks).where(and(eq(schema.inboundWebhooks.signatureValid, false), gte(schema.inboundWebhooks.receivedAt, monthAgo)));
  const failedEvents = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(schema.outboxEvents).where(sql`${schema.outboxEvents.publishedAt} IS NULL AND ${schema.outboxEvents.attempts} > 0`);
  const revenue30 = Number(money?.revenue30 ?? 0);
  const paid = Number(money?.paidOrders30 ?? 0);
  return {
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    attention,
    lateJobs: late[0]?.n ?? 0,
    failedWebhooks30: failedWebhooks[0]?.n ?? 0,
    stuckEvents: failedEvents[0]?.n ?? 0,
    revenueTodayMinor: Number(money?.revenueToday ?? 0),
    revenue30NetMinor: revenue30,
    grossMargin30: revenue30 ? Number(money?.margin30 ?? 0) / revenue30 : null,
    aov30NetMinor: paid ? Math.round(revenue30 / paid) : null,
    quoteToPurchase30: funnel?.quotes ? (funnel.payments ?? 0) / funnel.quotes : null,
    funnel30: funnel,
  };
}

export async function listOrdersAdmin(ctx: Ctx, opts: { status?: string; search?: string; limit?: number } = {}) {
  authorize(ctx.actor, "order.read.any");
  const where = [];
  if (opts.status) where.push(eq(schema.orders.status, opts.status));
  if (opts.search) where.push(sql`(${schema.orders.orderNumber} ILIKE ${"%" + opts.search + "%"} OR ${schema.users.email} ILIKE ${"%" + opts.search + "%"})`);
  return ctx.db
    .select({ order: schema.orders, email: schema.users.email })
    .from(schema.orders)
    .innerJoin(schema.users, eq(schema.users.id, schema.orders.customerUserId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.orders.createdAt))
    .limit(Math.min(opts.limit ?? 100, 500));
}

/** Everything the ops order page shows, loaded in one place (staff only). */
export async function orderDetail(ctx: Ctx, orderId: string) {
  authorize(ctx.actor, "order.read.any");
  const [row] = await ctx.db
    .select({ order: schema.orders, email: schema.users.email, locale: schema.users.preferredLocale, customerName: schema.users.displayName })
    .from(schema.orders)
    .innerJoin(schema.users, eq(schema.users.id, schema.orders.customerUserId))
    .where(eq(schema.orders.id, orderId));
  if (!row) throw notFound("order");
  const items = await ctx.db
    .select({ item: schema.orderItems, geometry: schema.geometryAnalyses, variant: schema.materialVariants, material: schema.materials })
    .from(schema.orderItems)
    .leftJoin(schema.geometryAnalyses, sql`${schema.geometryAnalyses.id} = (SELECT g.id FROM geometry_analyses g WHERE g.file_id = ${schema.orderItems.fileId} ORDER BY g.created_at DESC LIMIT 1)`)
    .leftJoin(schema.materialVariants, eq(schema.materialVariants.id, schema.orderItems.materialVariantId))
    .leftJoin(schema.materials, eq(schema.materials.id, schema.materialVariants.materialId))
    .where(eq(schema.orderItems.orderId, orderId))
    .orderBy(schema.orderItems.position);
  const jobs = await ctx.db
    .select({ job: schema.productionJobs, supplierName: schema.suppliers.name })
    .from(schema.productionJobs)
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.productionJobs.supplierId))
    .where(eq(schema.productionJobs.orderId, orderId))
    .orderBy(desc(schema.productionJobs.attemptNo));
  const payments = can(ctx.actor, "payment.read.any") ? await paymentsForOrder(ctx, orderId) : [];
  const refunds = payments.length ? await ctx.db.select().from(schema.refunds).where(inArray(schema.refunds.paymentId, payments.map((p) => p.id))).orderBy(desc(schema.refunds.createdAt)) : [];
  const [quote, history, messages, decisions, shipments, auditTrail] = await Promise.all([
    currentQuote(ctx, orderId),
    orderHistory(ctx, orderId),
    orderMessages(ctx, orderId),
    routingDecisions(ctx, orderId),
    shipmentsForOrder(ctx, orderId),
    can(ctx.actor, "audit.read") ? queryAudit(ctx, { resourceId: orderId, limit: 50 }) : Promise.resolve([]),
  ]);
  return { ...row, items, jobs, payments, refunds, quote, history, messages, decisions, shipments, auditTrail };
}

/** Suppliers with their payout position, for the finance payouts screen. */
export async function payoutOverview(ctx: Ctx) {
  authorize(ctx.actor, "payout.manage");
  const rows = await ctx.db.execute(sql`
    SELECT s.id, s.name, s.payout_details IS NOT NULL AS has_details, s.payout_details_changed_at,
      coalesce(sum(e.amount_minor) FILTER (WHERE e.statement_id IS NULL), 0)::bigint AS unstatemented,
      coalesce(sum(e.amount_minor), 0)::bigint AS balance
    FROM suppliers s LEFT JOIN payout_ledger_entries e ON e.supplier_id = s.id
    GROUP BY s.id ORDER BY s.name`);
  const statements = await ctx.db.select().from(schema.payoutStatements).where(eq(schema.payoutStatements.status, "closed")).orderBy(schema.payoutStatements.periodEnd);
  return {
    suppliers: (rows.rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      hasDetails: Boolean(r.has_details),
      detailsChangedAt: r.payout_details_changed_at ? new Date(String(r.payout_details_changed_at)) : null,
      unstatementedMinor: Number(r.unstatemented),
      balanceMinor: Number(r.balance),
    })),
    openStatements: statements,
  };
}
