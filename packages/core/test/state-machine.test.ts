import { ORDER_STATUSES, type OrderStatus } from "@mfg/db";
import { describe, expect, it } from "vitest";
import {
  checkTransition,
  eventsFrom,
  ORDER_TRANSITIONS,
  TERMINAL,
  type OrderEvent,
  type Trigger,
} from "../src/modules/orders/state-machine";

const EVENTS = Object.keys(ORDER_TRANSITIONS) as OrderEvent[];
const TRIGGERS: Trigger[] = ["customer", "staff", "system"];

describe("order state machine", () => {
  it("accepts exactly the declared (state, event, trigger) triples and nothing else", () => {
    let valid = 0;
    for (const status of ORDER_STATUSES) {
      for (const event of EVENTS) {
        for (const trigger of TRIGGERS) {
          const t = ORDER_TRANSITIONS[event];
          const declared =
            (t.from as readonly OrderStatus[]).includes(status) &&
            (t.by as readonly Trigger[]).includes(trigger);
          const result = checkTransition(status, event, trigger);
          expect(result.ok, `${status} --${event}/${trigger}-->`).toBe(declared);
          if (result.ok) {
            expect(result.to).toBe(t.to);
            valid++;
          }
        }
      }
    }
    expect(valid).toBeGreaterThan(40);
  });

  it("distinguishes an invalid transition from a forbidden trigger", () => {
    expect(checkTransition("DRAFT", "payment_succeeded", "system")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
    expect(checkTransition("PAYMENT_PENDING", "payment_succeeded", "customer")).toEqual({
      ok: false,
      reason: "not_allowed",
    });
  });

  it("blocks system transitions while an order is on hold but lets staff act", () => {
    expect(checkTransition("PAID", "routing_started", "system", { onHold: true })).toEqual({
      ok: false,
      reason: "on_hold",
    });
    expect(checkTransition("PAID", "routing_started", "staff", { onHold: true }).ok).toBe(true);
  });

  it("has no outgoing events from terminal states", () => {
    for (const s of TERMINAL) expect(eventsFrom(s)).toEqual([]);
  });

  it("can reach COMPLETED from DRAFT via the happy path", () => {
    const path: [OrderEvent, Trigger][] = [
      ["submit_requirements", "customer"],
      ["auto_quote_ready", "system"],
      ["checkout_started", "customer"],
      ["payment_succeeded", "system"],
      ["routing_started", "system"],
      ["supplier_assigned", "system"],
      ["supplier_accepted", "system"],
      ["production_started", "system"],
      ["production_completed", "system"],
      ["qc_passed", "system"],
      ["shipment_created", "system"],
      ["delivered", "system"],
      ["completed", "system"],
    ];
    let status: OrderStatus = "DRAFT";
    for (const [event, by] of path) {
      const r = checkTransition(status, event, by);
      expect(r.ok, `${status} ${event}`).toBe(true);
      if (r.ok) status = r.to;
    }
    expect(status).toBe("COMPLETED");
  });

  it("allows cancellation before payment and only staff/customer after payment before acceptance", () => {
    expect(checkTransition("QUOTE_READY", "cancel", "customer").ok).toBe(true);
    expect(checkTransition("PRODUCTION", "cancel", "customer").ok).toBe(false);
    expect(checkTransition("PAID", "cancel_paid", "customer").ok).toBe(true);
    expect(checkTransition("PRODUCTION", "cancel_paid", "staff").ok).toBe(false);
  });

  it("supports the QC failure → reprint → production loop", () => {
    expect(checkTransition("QC_PENDING", "qc_failed", "system").ok).toBe(true);
    expect(checkTransition("QC_FAILED", "reprint_ordered", "system").ok).toBe(true);
    expect(checkTransition("REPRINT_REQUIRED", "production_started", "system").ok).toBe(true);
  });
});
