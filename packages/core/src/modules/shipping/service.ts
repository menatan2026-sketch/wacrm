import { z } from "zod";
import { schema, uuidv7, and, desc, eq, inArray, lt } from "@mfg/db";
import type { Deps } from "../../deps";
import { audit } from "../../platform/audit";
import { publish } from "../../platform/outbox";
import { track } from "../../platform/analytics";
import { SYSTEM, type Ctx } from "../../shared/context";
import { DomainError, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { authorize } from "../identity/rbac";
import { lockOrder, transitionOrder } from "../orders/service";

const ORDER = ["LABEL_CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

export const manualShipmentSchema = z.object({
  carrier: z.string().trim().min(2).max(60),
  trackingNumber: z.string().trim().min(3).max(60),
  trackingUrl: z.url().optional(),
  costMinor: z.number().int().min(0).optional(),
});

/** Ship a QC-passed order: via the courier API when available, otherwise entered manually. */
export async function createShipment(
  d: Deps,
  ctx: Ctx,
  orderId: string,
  input: { mode: "provider" } | ({ mode: "manual" } & z.infer<typeof manualShipmentSchema>),
) {
  authorize(ctx.actor, "shipment.manage");
  return inTx(ctx, async (ctx) => {
    const order = await lockOrder(ctx, orderId);
    if (order.status !== "READY_FOR_SHIPMENT")
      throw new DomainError("orders.invalid_transition", 409);
    let shipment: {
      carrier: string;
      trackingNumber: string;
      trackingUrl: string | null;
      costMinor: number | null;
      provider: string;
    };
    if (input.mode === "provider") {
      if (!d.shipping.automatic) throw new DomainError("common.validation", 422, { field: "mode" });
      const [address] = order.shipToAddressId
        ? await ctx.db
            .select()
            .from(schema.addresses)
            .where(eq(schema.addresses.id, order.shipToAddressId))
        : [];
      if (!address) throw notFound("address");
      const [job] = await ctx.db
        .select()
        .from(schema.productionJobs)
        .where(
          and(
            eq(schema.productionJobs.orderId, orderId),
            eq(schema.productionJobs.status, "QC_PASSED"),
          ),
        );
      const [supplier] = job?.supplierId
        ? await ctx.db
            .select()
            .from(schema.suppliers)
            .where(eq(schema.suppliers.id, job.supplierId))
        : [];
      const r = await d.shipping.createShipment({
        orderNumber: order.orderNumber,
        serviceLevel: order.urgencyTier,
        recipient: {
          name: address.recipientName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          postalCode: address.postalCode,
        },
        from: {
          name: supplier?.name ?? "",
          city: supplier?.city ?? "",
          line1: supplier?.addressLine ?? "",
        },
      });
      shipment = { ...r, provider: d.shipping.name };
    } else {
      const m = manualShipmentSchema.parse(input);
      shipment = {
        carrier: m.carrier,
        trackingNumber: m.trackingNumber,
        trackingUrl: m.trackingUrl ?? null,
        costMinor: m.costMinor ?? null,
        provider: "manual",
      };
    }
    const id = uuidv7();
    await ctx.db.insert(schema.shipments).values({
      id,
      orderId,
      provider: shipment.provider,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      costMinor: shipment.costMinor,
      serviceLevel: order.urgencyTier,
      createdBy: ctx.actor.kind === "user" ? ctx.actor.userId : null,
    });
    await ctx.db.insert(schema.shipmentEvents).values({
      id: uuidv7(),
      shipmentId: id,
      status: "LABEL_CREATED",
      providerEventId: "created",
    });
    await ctx.db
      .update(schema.productionJobs)
      .set({ status: "HANDED_OFF", handedOffAt: ctx.clock.now() })
      .where(
        and(
          eq(schema.productionJobs.orderId, orderId),
          eq(schema.productionJobs.status, "QC_PASSED"),
        ),
      );
    await transitionOrder(ctx, orderId, "shipment_created", {
      trigger: ctx.actor.kind === "system" ? "system" : "staff",
    });
    await audit(ctx, {
      action: "shipment.created",
      resourceType: "shipment",
      resourceId: id,
      after: { carrier: shipment.carrier, mode: input.mode },
    });
    await publish(ctx, "notify.customer", {
      orderId,
      template: "shipped",
      vars: { carrier: shipment.carrier, tracking: shipment.trackingNumber },
    });
    await track(ctx, "shipment_created", { mode: input.mode }, { orderId });
    return id;
  });
}

/** Record a tracking status (from staff or the provider). Only forward moves are applied. */
export async function recordShipmentStatus(
  ctx: Ctx,
  shipmentId: string,
  status: string,
  providerEventId: string,
  description?: string,
) {
  if (ctx.actor.kind !== "system") authorize(ctx.actor, "shipment.manage");
  return inTx(ctx, async (ctx) => {
    const [s] = await ctx.db
      .select()
      .from(schema.shipments)
      .where(eq(schema.shipments.id, shipmentId))
      .for("update");
    if (!s) throw notFound("shipment");
    const inserted = await ctx.db
      .insert(schema.shipmentEvents)
      .values({
        id: uuidv7(),
        shipmentId,
        status,
        providerEventId,
        description: description ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: schema.shipmentEvents.id });
    if (!inserted.length) return;
    const forward =
      ORDER.indexOf(status) > ORDER.indexOf(s.status) ||
      status === "EXCEPTION" ||
      status === "RETURNED";
    if (!forward) return;
    await ctx.db
      .update(schema.shipments)
      .set({ status, ...(status === "DELIVERED" ? { deliveredAt: ctx.clock.now() } : {}) })
      .where(eq(schema.shipments.id, shipmentId));
    if (status === "DELIVERED") {
      await transitionOrder(ctx, s.orderId, "delivered", {
        trigger: ctx.actor.kind === "system" ? "system" : "staff",
      });
      await publish(ctx, "notify.customer", { orderId: s.orderId, template: "delivered" });
      await track(ctx, "delivered", {}, { orderId: s.orderId });
    }
  });
}

/** Scheduler: poll automatic providers for tracking updates. */
export async function syncTracking(d: Deps, ctx: Ctx): Promise<number> {
  if (!d.shipping.automatic) return 0;
  const open = await ctx.db
    .select()
    .from(schema.shipments)
    .where(
      and(
        eq(schema.shipments.provider, d.shipping.name),
        inArray(schema.shipments.status, [
          "LABEL_CREATED",
          "PICKED_UP",
          "IN_TRANSIT",
          "OUT_FOR_DELIVERY",
        ]),
      ),
    );
  for (const s of open) {
    for (const e of await d.shipping.trackShipment(s.trackingNumber!))
      await recordShipmentStatus(
        { ...ctx, actor: SYSTEM },
        s.id,
        e.status,
        e.providerEventId,
        e.description,
      );
  }
  return open.length;
}

export const DISPUTE_WINDOW_DAYS = 7;

/** Scheduler: delivered orders complete after the dispute window without a reported problem. */
export async function autoCompleteDelivered(ctx: Ctx): Promise<number> {
  const cutoff = new Date(ctx.clock.now().getTime() - DISPUTE_WINDOW_DAYS * 24 * 3600 * 1000);
  const due = await ctx.db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.status, "DELIVERED"),
        eq(schema.orders.onHold, false),
        lt(schema.orders.deliveredAt, cutoff),
      ),
    );
  for (const o of due)
    await transitionOrder({ ...ctx, actor: SYSTEM }, o.id, "completed", { trigger: "system" });
  return due.length;
}

export async function shipmentsForOrder(ctx: Ctx, orderId: string) {
  const shipments = await ctx.db
    .select()
    .from(schema.shipments)
    .where(eq(schema.shipments.orderId, orderId))
    .orderBy(desc(schema.shipments.createdAt));
  const events = shipments.length
    ? await ctx.db
        .select()
        .from(schema.shipmentEvents)
        .where(
          inArray(
            schema.shipmentEvents.shipmentId,
            shipments.map((s) => s.id),
          ),
        )
        .orderBy(schema.shipmentEvents.at)
    : [];
  return shipments.map((s) => ({ ...s, events: events.filter((e) => e.shipmentId === s.id) }));
}
