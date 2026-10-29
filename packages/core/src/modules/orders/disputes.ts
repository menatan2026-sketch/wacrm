import { schema, uuidv7, and, desc, eq } from "@mfg/db";
import type { Deps } from "../../deps";
import { audit } from "../../platform/audit";
import type { Ctx } from "../../shared/context";
import { DomainError, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { authorize, requireUser } from "../identity/rbac";
import { requestRefund } from "../payments/service";
import { lockOrder, transitionOrder } from "./service";

/** Customer reports a problem within the delivery window (or staff opens a dispute on their behalf). */
export async function reportProblem(ctx: Ctx, orderId: string, input: { description: string; photoFileIds?: string[] }) {
  const user = requireUser(ctx.actor);
  return inTx(ctx, async (ctx) => {
    const order = await lockOrder(ctx, orderId);
    if (order.customerUserId !== user.userId) authorize(user, "order.manage");
    const body = input.description.trim().slice(0, 4000);
    if (!body) throw new DomainError("common.validation", 422, { field: "description" });
    await transitionOrder(ctx, orderId, "dispute_opened", { reason: body.slice(0, 200) });
    await ctx.db.insert(schema.orderMessages).values({ id: uuidv7(), orderId, authorId: user.userId, authorType: order.customerUserId === user.userId ? "customer" : "staff", visibility: "customer", body });
    if (input.photoFileIds?.length) await audit(ctx, { action: "dispute.evidence", resourceType: "order", resourceId: orderId, after: { photoFileIds: input.photoFileIds } });
  });
}

/** Staff resolves a dispute: refund (full/partial), reprint, or close without action. */
export async function resolveDispute(d: Deps, ctx: Ctx, orderId: string, input: { resolution: "refund" | "reprint" | "close"; amountMinor?: number; reason: string; costBearer?: "supplier" | "platform" }) {
  authorize(ctx.actor, "order.manage");
  if (!input.reason.trim()) throw new DomainError("common.validation", 422, { field: "reason" });
  if (input.resolution === "refund") {
    const [payment] = await d.db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)).orderBy(desc(schema.payments.createdAt)).limit(1);
    if (!payment) throw notFound("payment");
    const amount = input.amountMinor ?? payment.amountMinor - payment.refundedMinor;
    await requestRefund(d, ctx, orderId, { amountMinor: amount, reasonCode: "dispute", note: input.reason });
    // A partial refund closes the dispute; a full refund moves the order to REFUNDED via the refund flow.
    if (amount < payment.amountMinor - payment.refundedMinor) await transitionOrder(ctx, orderId, "dispute_resolved", { reason: input.reason });
    return;
  }
  if (input.resolution === "close") {
    await transitionOrder(ctx, orderId, "dispute_resolved", { reason: input.reason });
    return;
  }
  await inTx(ctx, async (ctx) => {
    const [last] = await ctx.db.select().from(schema.productionJobs).where(and(eq(schema.productionJobs.orderId, orderId), eq(schema.productionJobs.status, "HANDED_OFF"))).orderBy(desc(schema.productionJobs.attemptNo)).limit(1);
    if (!last) throw notFound("job");
    const newJobId = uuidv7();
    await ctx.db.insert(schema.productionJobs).values({ id: newJobId, orderId, supplierId: last.supplierId, status: "ACCEPTED", attemptNo: last.attemptNo + 1, payoutMinor: input.costBearer === "supplier" ? 0 : last.payoutMinor, currency: last.currency, estimatedMinutes: last.estimatedMinutes, dueAt: new Date(ctx.clock.now().getTime() + 4 * 24 * 3600 * 1000), acceptedAt: ctx.clock.now() });
    await ctx.db.insert(schema.reprintRequests).values({ id: uuidv7(), jobId: last.id, newJobId, reasonCode: "other", rootCause: input.reason, costBearer: input.costBearer ?? "platform", createdBy: requireUser(ctx.actor).userId });
    await transitionOrder(ctx, orderId, "reprint_ordered", { reason: input.reason });
  });
}
