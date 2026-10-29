import { schema, uuidv7 } from "@mfg/db";
import { actorId, type Ctx } from "../shared/context";

/** Product-analytics event names (MASTER_PLAN §20). */
export const ANALYTICS_EVENTS = [
  "session_started",
  "upload_started",
  "upload_completed",
  "requirements_completed",
  "quote_created",
  "quote_viewed",
  "quote_expired",
  "checkout_started",
  "payment_success",
  "order_created",
  "design_requested",
  "supplier_assigned",
  "offer_declined",
  "production_started",
  "qc_passed",
  "qc_failed",
  "shipment_created",
  "delivered",
  "refund_completed",
  "repeat_order",
  "manual_action_taken",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export async function track(
  ctx: Ctx,
  name: AnalyticsEvent,
  props: Record<string, unknown> = {},
  extra: { orderId?: string; sessionId?: string; locale?: string; surface?: string } = {},
): Promise<void> {
  await ctx.db.insert(schema.analyticsEvents).values({
    id: uuidv7(),
    name,
    userId: actorId(ctx.actor),
    orderId: extra.orderId ?? null,
    sessionId: extra.sessionId ?? null,
    locale: extra.locale ?? null,
    surface: extra.surface ?? null,
    props,
  });
}
