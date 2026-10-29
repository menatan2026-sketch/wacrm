import type { OrderStatus } from "@mfg/db";

/** Who may fire an event: the order's customer, platform staff (order.manage), or the system. */
export type Trigger = "customer" | "staff" | "system";

export interface Transition {
  from: readonly OrderStatus[];
  to: OrderStatus;
  by: readonly Trigger[];
}

const PRE_PAYMENT: OrderStatus[] = [
  "DRAFT",
  "REQUIREMENTS_PENDING",
  "REVIEW_REQUIRED",
  "DESIGN_REQUIRED",
  "DESIGN_IN_PROGRESS",
  "DESIGN_APPROVAL",
  "QUOTE_READY",
  "PAYMENT_PENDING",
];

/**
 * The customer-facing order lifecycle (DATABASE.md §5.1). Production, QC, payment and shipping
 * sub-machines advance the order by firing system events.
 */
export const ORDER_TRANSITIONS = {
  submit_requirements: { from: ["DRAFT"], to: "REQUIREMENTS_PENDING", by: ["customer", "staff"] },
  auto_quote_ready: { from: ["REQUIREMENTS_PENDING"], to: "QUOTE_READY", by: ["system"] },
  needs_review: { from: ["REQUIREMENTS_PENDING", "DRAFT"], to: "REVIEW_REQUIRED", by: ["system", "customer", "staff"] },
  requires_design: { from: ["REVIEW_REQUIRED"], to: "DESIGN_REQUIRED", by: ["staff"] },
  design_started: { from: ["DESIGN_REQUIRED"], to: "DESIGN_IN_PROGRESS", by: ["staff"] },
  design_submitted: { from: ["DESIGN_IN_PROGRESS"], to: "DESIGN_APPROVAL", by: ["staff"] },
  design_changes_requested: { from: ["DESIGN_APPROVAL"], to: "DESIGN_IN_PROGRESS", by: ["customer"] },
  design_approved: { from: ["DESIGN_APPROVAL"], to: "REVIEW_REQUIRED", by: ["customer"] },
  publish_quote: { from: ["REVIEW_REQUIRED", "REQUIREMENTS_PENDING", "DESIGN_REQUIRED"], to: "QUOTE_READY", by: ["staff"] },
  quote_expired: { from: ["QUOTE_READY", "PAYMENT_PENDING"], to: "REQUIREMENTS_PENDING", by: ["system"] },
  requote: { from: ["QUOTE_READY"], to: "QUOTE_READY", by: ["customer", "staff", "system"] },
  checkout_started: { from: ["QUOTE_READY", "PAYMENT_PENDING"], to: "PAYMENT_PENDING", by: ["customer"] },
  payment_failed: { from: ["PAYMENT_PENDING"], to: "QUOTE_READY", by: ["system"] },
  payment_succeeded: { from: ["PAYMENT_PENDING", "QUOTE_READY"], to: "PAID", by: ["system"] },
  routing_started: { from: ["PAID"], to: "ROUTING", by: ["system", "staff"] },
  supplier_assigned: { from: ["ROUTING"], to: "SUPPLIER_ASSIGNED", by: ["system", "staff"] },
  offer_lapsed: { from: ["SUPPLIER_ASSIGNED"], to: "ROUTING", by: ["system", "staff"] },
  supplier_accepted: { from: ["SUPPLIER_ASSIGNED"], to: "SUPPLIER_ACCEPTED", by: ["system"] },
  production_started: { from: ["SUPPLIER_ACCEPTED", "REPRINT_REQUIRED"], to: "PRODUCTION", by: ["system"] },
  production_completed: { from: ["PRODUCTION"], to: "QC_PENDING", by: ["system"] },
  qc_passed: { from: ["QC_PENDING"], to: "READY_FOR_SHIPMENT", by: ["system"] },
  qc_failed: { from: ["QC_PENDING"], to: "QC_FAILED", by: ["system"] },
  reprint_ordered: { from: ["QC_FAILED", "DISPUTED"], to: "REPRINT_REQUIRED", by: ["system", "staff"] },
  accepted_with_concession: { from: ["QC_FAILED"], to: "READY_FOR_SHIPMENT", by: ["staff"] },
  shipment_created: { from: ["READY_FOR_SHIPMENT"], to: "SHIPPED", by: ["system", "staff"] },
  delivered: { from: ["SHIPPED"], to: "DELIVERED", by: ["system", "staff"] },
  completed: { from: ["DELIVERED"], to: "COMPLETED", by: ["system", "customer"] },
  cancel: { from: [...PRE_PAYMENT], to: "CANCELLED", by: ["customer", "staff"] },
  cancel_paid: { from: ["PAID", "ROUTING", "SUPPLIER_ASSIGNED", "SUPPLIER_ACCEPTED"], to: "CANCELLED", by: ["customer", "staff"] },
  dispute_opened: { from: ["PRODUCTION", "QC_PENDING", "SHIPPED", "DELIVERED"], to: "DISPUTED", by: ["customer", "staff"] },
  dispute_resolved: { from: ["DISPUTED"], to: "COMPLETED", by: ["staff"] },
  refund_completed: { from: ["CANCELLED", "DISPUTED"], to: "REFUNDED", by: ["system"] },
} as const satisfies Record<string, Transition>;

export type OrderEvent = keyof typeof ORDER_TRANSITIONS;

export const TERMINAL: readonly OrderStatus[] = ["COMPLETED", "REFUNDED"];

export type TransitionCheck = { ok: true; to: OrderStatus } | { ok: false; reason: "invalid_transition" | "not_allowed" | "on_hold" };

/** Pure validation of one transition. Persistence and side effects live in the order service. */
export function checkTransition(
  status: OrderStatus,
  event: OrderEvent,
  trigger: Trigger,
  opts: { onHold?: boolean } = {},
): TransitionCheck {
  const t: Transition = ORDER_TRANSITIONS[event];
  if (!t.from.includes(status)) return { ok: false, reason: "invalid_transition" };
  if (!t.by.includes(trigger)) return { ok: false, reason: "not_allowed" };
  // On-hold orders only move by explicit human action.
  if (opts.onHold && trigger === "system") return { ok: false, reason: "on_hold" };
  return { ok: true, to: t.to };
}

export const eventsFrom = (status: OrderStatus): OrderEvent[] =>
  (Object.keys(ORDER_TRANSITIONS) as OrderEvent[]).filter((e) => (ORDER_TRANSITIONS[e].from as readonly OrderStatus[]).includes(status));
