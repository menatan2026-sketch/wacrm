import { schema, uuidv7, and, desc, eq, isNull, lte, sql } from "@mfg/db";
import { audit } from "../../platform/audit";
import type { Ctx } from "../../shared/context";
import { DomainError, forbidden, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { authorize, can, requireUser } from "../identity/rbac";

/** Payout details changed within this window block payment until verified (fraud control). */
export const PAYOUT_DETAILS_HOLD_MS = 48 * 3600 * 1000;

export async function supplierBalance(ctx: Ctx, supplierId: string) {
  if (!can(ctx.actor, "payout.read.own", { supplierId }) && !can(ctx.actor, "payout.manage")) throw forbidden();
  const [row] = await ctx.db
    .select({
      unstatemented: sql<number>`coalesce(sum(amount_minor) FILTER (WHERE statement_id IS NULL), 0)`,
      total: sql<number>`coalesce(sum(amount_minor), 0)`,
    })
    .from(schema.payoutLedgerEntries)
    .where(eq(schema.payoutLedgerEntries.supplierId, supplierId));
  const statements = await ctx.db.select().from(schema.payoutStatements).where(eq(schema.payoutStatements.supplierId, supplierId)).orderBy(desc(schema.payoutStatements.periodEnd));
  const entries = await ctx.db.select().from(schema.payoutLedgerEntries).where(eq(schema.payoutLedgerEntries.supplierId, supplierId)).orderBy(desc(schema.payoutLedgerEntries.createdAt)).limit(100);
  return { pendingMinor: Number(row?.unstatemented ?? 0), balanceMinor: Number(row?.total ?? 0), statements, entries };
}

/** Finance closes a period: all unattached earnings up to `periodEnd` go on one statement. */
export async function closeStatement(ctx: Ctx, supplierId: string, periodEnd: Date) {
  authorize(ctx.actor, "payout.manage");
  return inTx(ctx, async (ctx) => {
    const entries = await ctx.db
      .select()
      .from(schema.payoutLedgerEntries)
      .where(and(eq(schema.payoutLedgerEntries.supplierId, supplierId), isNull(schema.payoutLedgerEntries.statementId), lte(schema.payoutLedgerEntries.createdAt, periodEnd)))
      .for("update");
    if (!entries.length) throw new DomainError("common.conflict", 409, { reason: "nothing_to_statement" });
    const id = uuidv7();
    const total = entries.reduce((s, e) => s + e.amountMinor, 0);
    const start = entries.reduce((m, e) => (e.createdAt < m ? e.createdAt : m), entries[0]!.createdAt);
    await ctx.db.insert(schema.payoutStatements).values({ id, supplierId, periodStart: start.toISOString().slice(0, 10), periodEnd: periodEnd.toISOString().slice(0, 10), totalMinor: total, status: "closed" });
    for (const e of entries) await ctx.db.update(schema.payoutLedgerEntries).set({ statementId: id }).where(eq(schema.payoutLedgerEntries.id, e.id));
    await audit(ctx, { action: "payout.statement_closed", resourceType: "payout_statement", resourceId: id, after: { total, entries: entries.length } });
    return id;
  });
}

/** Record that finance paid a statement by bank transfer (manual export in the MVP). */
export async function markStatementPaid(ctx: Ctx, statementId: string, reference: string) {
  authorize(ctx.actor, "payout.manage");
  requireUser(ctx.actor);
  return inTx(ctx, async (ctx) => {
    const [st] = await ctx.db.select().from(schema.payoutStatements).where(eq(schema.payoutStatements.id, statementId)).for("update");
    if (!st || st.status !== "closed") throw notFound("payout_statement");
    const [supplier] = await ctx.db.select().from(schema.suppliers).where(eq(schema.suppliers.id, st.supplierId));
    if (!supplier?.payoutDetails) throw new DomainError("suppliers.onboarding_incomplete", 409);
    if (supplier.payoutDetailsChangedAt && ctx.clock.now().getTime() - supplier.payoutDetailsChangedAt.getTime() < PAYOUT_DETAILS_HOLD_MS) {
      throw new DomainError("common.conflict", 409, { reason: "payout_details_recently_changed" });
    }
    await ctx.db.update(schema.payoutStatements).set({ status: "paid", paidAt: ctx.clock.now() }).where(eq(schema.payoutStatements.id, statementId));
    await ctx.db.insert(schema.payoutLedgerEntries).values({ id: uuidv7(), supplierId: st.supplierId, statementId, kind: "payment", amountMinor: -st.totalMinor, currency: st.currency, note: reference.slice(0, 120) });
    await audit(ctx, { action: "payout.statement_paid", resourceType: "payout_statement", resourceId: statementId, after: { reference } });
  });
}
