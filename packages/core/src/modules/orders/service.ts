import { schema, uuidv7, and, desc, eq, inArray, sql, type OrderStatus } from "@mfg/db";
import { audit } from "../../platform/audit";
import { publish } from "../../platform/outbox";
import { track } from "../../platform/analytics";
import { actorId, actorType, type Ctx } from "../../shared/context";
import { DomainError, forbidden, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { can, requireUser } from "../identity/rbac";
import { checkTransition, ORDER_TRANSITIONS, type OrderEvent, type Trigger } from "./state-machine";

export type OrderRow = typeof schema.orders.$inferSelect;

/** Timestamp columns stamped when an order first reaches a status (KPI inputs). */
const STAMP: Partial<Record<OrderStatus, keyof OrderRow>> = {
  PAID: "paidAt",
  SHIPPED: "shippedAt",
  DELIVERED: "deliveredAt",
  COMPLETED: "completedAt",
  CANCELLED: "cancelledAt",
};

export function triggerFor(ctx: Ctx, order: OrderRow): Trigger {
  if (ctx.actor.kind === "system") return "system";
  if (ctx.actor.kind === "user") {
    if (order.customerUserId === ctx.actor.userId) return "customer";
    if (can(ctx.actor, "order.manage")) return "staff";
  }
  throw forbidden();
}

export async function lockOrder(ctx: Ctx, orderId: string): Promise<OrderRow> {
  const [order] = await ctx.db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .for("update");
  if (!order) throw notFound("order");
  return order;
}

/**
 * The only way an order changes status: validates the transition and the trigger, stamps
 * timestamps, writes history, audit and an outbox event — all in one transaction.
 */
export async function transitionOrder(
  ctx: Ctx,
  orderId: string,
  event: OrderEvent,
  opts: { reason?: string; patch?: Partial<OrderRow>; trigger?: Trigger } = {},
): Promise<OrderRow> {
  return inTx(ctx, async (ctx) => {
    const order = await lockOrder(ctx, orderId);
    const trigger = opts.trigger ?? triggerFor(ctx, order);
    const check = checkTransition(order.status as OrderStatus, event, trigger, {
      onHold: order.onHold,
    });
    if (!check.ok) {
      throw new DomainError(
        check.reason === "on_hold"
          ? "orders.on_hold"
          : check.reason === "not_allowed"
            ? "auth.forbidden"
            : "orders.invalid_transition",
        check.reason === "not_allowed" ? 403 : 409,
        {
          from: order.status,
          event,
        },
      );
    }
    const now = ctx.clock.now();
    const stamp = STAMP[check.to];
    const patch: Partial<OrderRow> = { ...opts.patch, status: check.to, statusChangedAt: now };
    if (stamp && !order[stamp]) (patch as Record<string, unknown>)[stamp] = now;
    const [updated] = await ctx.db
      .update(schema.orders)
      .set(patch)
      .where(eq(schema.orders.id, orderId))
      .returning();
    await ctx.db.insert(schema.orderStatusHistory).values({
      id: uuidv7(),
      orderId,
      fromStatus: order.status,
      toStatus: check.to,
      event,
      actorId: actorId(ctx.actor),
      actorType: actorType(ctx.actor),
      reason: opts.reason ?? null,
    });
    await audit(ctx, {
      action: `order.${event}`,
      resourceType: "order",
      resourceId: orderId,
      before: { status: order.status },
      after: { status: check.to },
      reason: opts.reason,
    });
    await publish(ctx, `order.${event}`, { orderId, from: order.status, to: check.to });
    if (trigger === "staff")
      await track(ctx, "manual_action_taken", { action: `order.${event}` }, { orderId });
    return updated!;
  });
}

export const canTransition = (order: OrderRow, event: OrderEvent, trigger: Trigger) =>
  checkTransition(order.status as OrderStatus, event, trigger, { onHold: order.onHold }).ok;
export { ORDER_TRANSITIONS };

/** Load an order the actor may see: the customer's own, or any for staff with order.read.any. */
export async function getOrderForActor(ctx: Ctx, orderId: string): Promise<OrderRow> {
  const [order] = await ctx.db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!order) throw notFound("order");
  if (ctx.actor.kind === "system") return order;
  const user = requireUser(ctx.actor);
  if (order.customerUserId === user.userId || can(user, "order.read.any")) return order;
  throw notFound("order");
}

export async function nextOrderNumber(ctx: Ctx): Promise<string> {
  const res = await ctx.db.execute(sql`SELECT nextval('order_number_seq') AS n`);
  const n = Number((res.rows[0] as { n: string }).n);
  return `MF-${String(ctx.clock.now().getUTCFullYear()).slice(2)}-${String(n).padStart(6, "0")}`;
}

export async function listCustomerOrders(ctx: Ctx) {
  const user = requireUser(ctx.actor);
  return ctx.db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.customerUserId, user.userId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(100);
}

export async function orderItems(ctx: Ctx, orderId: string) {
  return ctx.db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId))
    .orderBy(schema.orderItems.position);
}

export async function orderHistory(ctx: Ctx, orderId: string) {
  return ctx.db
    .select()
    .from(schema.orderStatusHistory)
    .where(eq(schema.orderStatusHistory.orderId, orderId))
    .orderBy(schema.orderStatusHistory.at);
}

/** Messages visible to the actor: customers see customer-visible ones only. */
export async function orderMessages(ctx: Ctx, orderId: string) {
  const order = await getOrderForActor(ctx, orderId);
  const customerView = ctx.actor.kind === "user" && ctx.actor.userId === order.customerUserId;
  const t = schema.orderMessages;
  return ctx.db
    .select()
    .from(t)
    .where(
      customerView
        ? and(eq(t.orderId, orderId), eq(t.visibility, "customer"))
        : eq(t.orderId, orderId),
    )
    .orderBy(t.createdAt);
}

export async function addOrderMessage(
  ctx: Ctx,
  orderId: string,
  input: { body: string; visibility: "customer" | "internal" },
) {
  return inTx(ctx, async (ctx) => {
    const order = await getOrderForActor(ctx, orderId);
    const user = requireUser(ctx.actor);
    const isCustomer = user.userId === order.customerUserId;
    if (!isCustomer && !can(user, "order.message")) throw forbidden();
    const visibility = isCustomer ? "customer" : input.visibility;
    const body = input.body.trim().slice(0, 4000);
    if (!body) throw new DomainError("common.validation", 422);
    await ctx.db.insert(schema.orderMessages).values({
      id: uuidv7(),
      orderId,
      authorId: user.userId,
      authorType: isCustomer ? "customer" : "staff",
      visibility,
      body,
    });
    if (!isCustomer && visibility === "customer") {
      await publish(ctx, "notify.customer", {
        orderId,
        template: "customer_message",
        vars: { message: body.slice(0, 300) },
      });
    }
    if (!isCustomer)
      await audit(ctx, {
        action: "order.message",
        resourceType: "order",
        resourceId: orderId,
        after: { visibility },
      });
  });
}

export async function setHold(ctx: Ctx, orderId: string, onHold: boolean, reason: string) {
  return inTx(ctx, async (ctx) => {
    const user = requireUser(ctx.actor);
    if (!can(user, "order.manage")) throw forbidden();
    const order = await lockOrder(ctx, orderId);
    await ctx.db
      .update(schema.orders)
      .set({ onHold, holdReason: onHold ? reason : null })
      .where(eq(schema.orders.id, orderId));
    await audit(ctx, {
      action: onHold ? "order.hold" : "order.unhold",
      resourceType: "order",
      resourceId: orderId,
      before: { onHold: order.onHold },
      after: { onHold },
      reason,
    });
    await track(ctx, "manual_action_taken", { action: onHold ? "hold" : "unhold" }, { orderId });
  });
}

/** System-side hold used when automation cannot proceed (routing failure, amount mismatch). */
export async function systemHold(ctx: Ctx, orderId: string, reason: string) {
  await ctx.db
    .update(schema.orders)
    .set({ onHold: true, holdReason: reason })
    .where(eq(schema.orders.id, orderId));
  await audit(ctx, { action: "order.hold", resourceType: "order", resourceId: orderId, reason });
}

export async function ordersByStatus(ctx: Ctx, statuses: OrderStatus[]) {
  return ctx.db
    .select()
    .from(schema.orders)
    .where(inArray(schema.orders.status, statuses))
    .orderBy(schema.orders.statusChangedAt);
}
