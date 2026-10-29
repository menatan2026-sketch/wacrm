import { schema, eq } from "@mfg/db";
import { beforeEach, describe, expect, it } from "vitest";
import * as drafts from "../../src/modules/drafts/service";
import * as orders from "../../src/modules/orders/service";
import * as payments from "../../src/modules/payments/service";
import * as production from "../../src/modules/production/service";
import * as quotes from "../../src/modules/quotes/service";
import * as routing from "../../src/modules/routing/service";
import * as shipping from "../../src/modules/shipping/service";
import * as payouts from "../../src/modules/payouts/service";
import { SYSTEM } from "../../src/shared/context";
import { createHarness, type Harness } from "./harness";
import { quotedOrder, USAGE } from "./fixtures";

const ADDRESS = {
  recipientName: "Dana Cohen",
  phone: "050-0000000",
  line1: "Herzl 1",
  city: "Haifa",
};

let h: Harness;
beforeEach(async () => {
  h = await createHarness();
});

async function paid(h: Harness) {
  const q = await quotedOrder(h);
  const { checkoutUrl } = await payments.startCheckout(h.d, h.ctx(q.customer), q.orderId, {
    address: ADDRESS,
    idempotencyKey: "k1",
    locale: "en",
  });
  const ref = checkoutUrl.split("/").pop()!;
  const quote = await quotes.currentQuote(h.ctx(SYSTEM), q.orderId);
  const hook = h.payments.buildWebhook({
    providerEventId: "evt-1",
    type: "payment.captured",
    providerRef: ref,
    amountMinor: quote!.snapshot.totalMinor,
    currency: "ILS",
  });
  expect(await payments.handlePaymentWebhook(h.d, hook.body, hook.headers)).toBe("processed");
  return { ...q, hook, ref, quote: quote! };
}

describe("Flow A end to end", () => {
  it("goes from guest upload to completed order with snapshot, invoice, payout and audit trail", async () => {
    const q = await quotedOrder(h);
    expect(q.preview.price?.totalMinor).toBeGreaterThan(0);
    expect(q.preview.materials[0]!.code).toBe("PLA");
    expect(q.outcome).toBe("quoted");

    const order0 = await orders.getOrderForActor(h.ctx(q.customer), q.orderId);
    expect(order0.status).toBe("QUOTE_READY");
    const quote = await quotes.currentQuote(h.ctx(q.customer), q.orderId);
    // The order quote equals the wizard preview (same inputs, same rules).
    expect(quote!.snapshot.totalMinor).toBe(q.preview.price!.totalMinor);
    expect(h.email.sent.some((m) => m.template === "quote_ready")).toBe(false); // delivered by the worker
    await h.drain();
    expect(
      h.email.sent.some((m) => m.template === "quote_ready" && m.to === "dana@example.com"),
    ).toBe(true);

    // Checkout is idempotent per key.
    const c1 = await payments.startCheckout(h.d, h.ctx(q.customer), q.orderId, {
      address: ADDRESS,
      idempotencyKey: "k1",
      locale: "en",
    });
    const c2 = await payments.startCheckout(h.d, h.ctx(q.customer), q.orderId, {
      address: ADDRESS,
      idempotencyKey: "k1",
      locale: "en",
    });
    expect(c2.paymentId).toBe(c1.paymentId);
    const ref = c1.checkoutUrl.split("/").pop()!;
    const hook = h.payments.buildWebhook({
      providerEventId: "evt-1",
      type: "payment.captured",
      providerRef: ref,
      amountMinor: quote!.snapshot.totalMinor,
      currency: "ILS",
    });
    expect(await payments.handlePaymentWebhook(h.d, hook.body, hook.headers)).toBe("processed");
    expect(await payments.handlePaymentWebhook(h.d, hook.body, hook.headers)).toBe("duplicate");
    let order = await orders.getOrderForActor(h.ctx(SYSTEM), q.orderId);
    expect(order.status).toBe("PAID");
    expect(order.paidAt).not.toBeNull();
    const [receipt] = await h.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.orderId, q.orderId));
    expect(receipt!.totalMinor).toBe(quote!.snapshot.totalMinor);

    // order.paid → routing proposal (AUTO_ROUTING off ⇒ ops confirms).
    await h.drain();
    order = await orders.getOrderForActor(h.ctx(SYSTEM), q.orderId);
    expect(order.status).toBe("ROUTING");
    const [decision] = await routing.routingDecisions(
      h.ctx(await h.signIn("admin@mfg.local", "admin")),
      q.orderId,
    );
    expect(decision!.candidates.filter((c) => !c.excludedReason)).toHaveLength(2);
    const admin = await h.signIn("admin@mfg.local", "admin");
    const offerId = await routing.offerToSupplier(
      h.d,
      h.ctx(admin),
      q.orderId,
      decision!.chosenSupplierId!,
      "manual_confirmed",
    );
    await h.drain();
    expect(h.email.sent.some((m) => m.template === "offer_received")).toBe(true);

    // The chosen supplier accepts on the partner surface.
    const [supplier] = await h.db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, decision!.chosenSupplierId!));
    const partner = await h.signIn(supplier!.contactEmail, "supplier");
    await routing.respondToOffer(h.d, h.ctx(partner), offerId!, { accept: true });
    const [job] = await h.db
      .select()
      .from(schema.productionJobs)
      .where(eq(schema.productionJobs.orderId, q.orderId));
    expect(job!.status).toBe("ACCEPTED");
    expect(job!.payoutMinor).toBe(quote!.snapshot.expectedPayoutMinor);

    await production.startProduction(h.ctx(partner), job!.id);
    const photos = [
      await h.uploadPhoto(partner, "qc_photo"),
      await h.uploadPhoto(partner, "qc_photo"),
    ];
    const card = await production.jobCard(h.ctx(partner), job!.id);
    expect(card.qc.measurements.map((m) => m.name)).toEqual(["x", "y", "z"]);
    await production.submitEvidence(h.ctx(partner), job!.id, {
      photoFileIds: photos,
      measurements: card.qc.measurements.map((m) => ({ name: m.name, measuredMm: m.expectedMm })),
      checklist: Object.fromEntries(production.QC_CHECKLIST.map((c) => [c, true])),
    });
    const qc = await h.signIn("qc@mfg.local", "admin");
    await production.reviewQc(h.ctx(qc), job!.id, { verdict: "pass" });
    order = await orders.getOrderForActor(h.ctx(SYSTEM), q.orderId);
    expect(order.status).toBe("READY_FOR_SHIPMENT");

    await shipping.createShipment(h.d, h.ctx(admin), q.orderId, { mode: "provider" });
    for (let i = 0; i < 4; i++) await shipping.syncTracking(h.d, h.ctx(SYSTEM));
    order = await orders.getOrderForActor(h.ctx(SYSTEM), q.orderId);
    expect(order.status).toBe("DELIVERED");
    h.clock.advance(8 * 24 * 3600 * 1000);
    await shipping.autoCompleteDelivered(h.ctx(SYSTEM));
    order = await orders.getOrderForActor(h.ctx(SYSTEM), q.orderId);
    expect(order.status).toBe("COMPLETED");

    const history = await orders.orderHistory(h.ctx(SYSTEM), q.orderId);
    expect(history.map((x) => x.toStatus)).toEqual([
      "REQUIREMENTS_PENDING",
      "QUOTE_READY",
      "PAYMENT_PENDING",
      "PAID",
      "ROUTING",
      "SUPPLIER_ASSIGNED",
      "SUPPLIER_ACCEPTED",
      "PRODUCTION",
      "QC_PENDING",
      "READY_FOR_SHIPMENT",
      "SHIPPED",
      "DELIVERED",
      "COMPLETED",
    ]);
    const balance = await payouts.supplierBalance(h.ctx(partner), supplier!.id);
    expect(balance.pendingMinor).toBe(job!.payoutMinor);
    const auditRows = await h.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.resourceId, q.orderId));
    expect(auditRows.length).toBeGreaterThanOrEqual(13);
    const events = (await h.db.select().from(schema.analyticsEvents)).map((e) => e.name);
    for (const e of [
      "upload_started",
      "upload_completed",
      "order_created",
      "quote_created",
      "checkout_started",
      "payment_success",
      "supplier_assigned",
      "production_started",
      "qc_passed",
      "shipment_created",
      "delivered",
    ]) {
      expect(events, e).toContain(e);
    }
  });

  it("never lets quote snapshots be edited or deleted", async () => {
    const q = await quotedOrder(h);
    const quote = await quotes.currentQuote(h.ctx(SYSTEM), q.orderId);
    const insertOnly = {
      cause: expect.objectContaining({ message: expect.stringMatching(/insert-only/) }),
    };
    await expect(
      h.db
        .update(schema.quoteSnapshots)
        .set({ totalMinor: 1 })
        .where(eq(schema.quoteSnapshots.quoteId, quote!.quote.id)),
    ).rejects.toMatchObject(insertOnly);
    await expect(h.db.delete(schema.auditEvents)).rejects.toMatchObject(insertOnly);
  });

  it("re-quotes with current rules after expiry and keeps the old snapshot", async () => {
    const q = await quotedOrder(h);
    const first = await quotes.currentQuote(h.ctx(SYSTEM), q.orderId);
    h.clock.advance(15 * 24 * 3600 * 1000);
    expect(await quotes.expireQuotes(h.d, h.ctx(SYSTEM))).toBe(1);
    const second = await quotes.currentQuote(h.ctx(SYSTEM), q.orderId);
    expect(second!.quote.id).not.toBe(first!.quote.id);
    const [old] = await h.db
      .select()
      .from(schema.quotes)
      .where(eq(schema.quotes.id, first!.quote.id));
    expect(old!.status).toBe("expired");
    expect((await orders.getOrderForActor(h.ctx(SYSTEM), q.orderId)).status).toBe("QUOTE_READY");
    await expect(
      payments.startCheckout(h.d, h.ctx(q.customer), q.orderId, {
        address: ADDRESS,
        idempotencyKey: "x",
        locale: "en",
      }),
    ).resolves.toBeTruthy();
  });

  it("routes to manual review when a guard trips (food contact)", async () => {
    const guest = { kind: "guest" as const, anonKey: "a1" };
    const draft = await drafts.startDraft(h.ctx(guest), "file");
    const fileId = await h.uploadModel(guest);
    await h.drain();
    await drafts.saveDraft(h.ctx(guest), draft.id, {
      patch: { fileId, units: "mm", usage: { ...USAGE, foodContact: true } },
    });
    const customer = await h.signIn("eli@example.com");
    await drafts.claimDrafts(h.ctx(customer), "a1", customer.userId);
    const { orderId, outcome } = await drafts.submitDraft(h.d, h.ctx(customer), draft.id, "he");
    expect(outcome).toBe("review");
    const order = await orders.getOrderForActor(h.ctx(customer), orderId);
    expect(order.status).toBe("REVIEW_REQUIRED");
    expect(order.reviewReasons).toEqual(
      expect.arrayContaining(["food_contact", "no_material_fits"]),
    );
  });
});

describe("payments", () => {
  it("rejects forged webhooks and holds orders on amount mismatch", async () => {
    const q = await quotedOrder(h);
    const { checkoutUrl } = await payments.startCheckout(h.d, h.ctx(q.customer), q.orderId, {
      address: ADDRESS,
      idempotencyKey: "k",
      locale: "en",
    });
    const ref = checkoutUrl.split("/").pop()!;
    const forged = JSON.stringify({
      providerEventId: "x",
      type: "payment.captured",
      providerRef: ref,
      amountMinor: 1,
      currency: "ILS",
    });
    expect(await payments.handlePaymentWebhook(h.d, forged, { "x-fake-signature": "nope" })).toBe(
      "invalid",
    );
    const wrong = h.payments.buildWebhook({
      providerEventId: "evt-x",
      type: "payment.captured",
      providerRef: ref,
      amountMinor: 100,
      currency: "ILS",
    });
    await payments.handlePaymentWebhook(h.d, wrong.body, wrong.headers);
    const order = await orders.getOrderForActor(h.ctx(SYSTEM), q.orderId);
    expect(order.status).toBe("PAYMENT_PENDING");
    expect(order.onHold).toBe(true);
    expect(order.holdReason).toBe("payment_amount_mismatch");
  });

  it("refunds automatically when a paid order is cancelled before supplier acceptance", async () => {
    const p = await paid(h);
    await payments.cancelOrder(h.d, h.ctx(p.customer), p.orderId, "changed my mind");
    const order = await orders.getOrderForActor(h.ctx(SYSTEM), p.orderId);
    expect(order.status).toBe("REFUNDED");
    const [payment] = await payments.paymentsForOrder(h.ctx(SYSTEM), p.orderId);
    expect(payment!.status).toBe("REFUNDED");
    expect(payment!.refundedMinor).toBe(payment!.amountMinor);
    const docs = await h.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.orderId, p.orderId));
    expect(docs.map((x) => x.kind).sort()).toEqual(["credit_note", "receipt"]);
  });

  it("requires finance approval for large refunds by support, and a second person", async () => {
    const p = await paid(h);
    const support = await h.signIn("support@mfg.local", "admin");
    const refundId = await payments.requestRefund(h.d, h.ctx(support), p.orderId, {
      amountMinor: Math.min(p.quote.snapshot.totalMinor, 60_000),
      reasonCode: "goodwill",
    });
    const [r] = await h.db.select().from(schema.refunds).where(eq(schema.refunds.id, refundId));
    expect(r!.status).toBe(p.quote.snapshot.totalMinor > 50_000 ? "requested" : "completed");
    if (r!.status === "requested") {
      await expect(payments.approveRefund(h.d, h.ctx(support), refundId)).rejects.toThrow(
        "auth.forbidden",
      );
      const finance = await h.signIn("finance@mfg.local", "admin");
      await payments.approveRefund(h.d, h.ctx(finance), refundId);
      const [done] = await h.db
        .select()
        .from(schema.refunds)
        .where(eq(schema.refunds.id, refundId));
      expect(done!.status).toBe("completed");
    }
    await expect(
      payments.requestRefund(h.d, h.ctx(support), p.orderId, {
        amountMinor: p.quote.snapshot.totalMinor * 2,
        reasonCode: "x",
      }),
    ).rejects.toThrow("payments.refund_exceeds_captured");
  });
});

describe("routing and QC loops", () => {
  async function routedToOffer() {
    const p = await paid(h);
    await h.drain();
    const admin = await h.signIn("admin@mfg.local", "admin");
    const [decision] = await routing.routingDecisions(h.ctx(admin), p.orderId);
    const offerId = await routing.offerToSupplier(
      h.d,
      h.ctx(admin),
      p.orderId,
      decision!.chosenSupplierId!,
      "manual_confirmed",
    );
    const [s] = await h.db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, decision!.chosenSupplierId!));
    return {
      ...p,
      admin,
      offerId: offerId!,
      supplier: s!,
      partner: await h.signIn(s!.contactEmail, "supplier"),
    };
  }

  it("re-routes to the next supplier after a decline, excluding the one that declined", async () => {
    const r = await routedToOffer();
    await routing.respondToOffer(h.d, h.ctx(r.partner), r.offerId, {
      accept: false,
      declineReason: "no capacity",
    });
    const decisions = await routing.routingDecisions(h.ctx(r.admin), r.orderId);
    expect(decisions[0]!.chosenSupplierId).not.toBe(r.supplier.id);
    expect(
      decisions[0]!.candidates.find((c) => c.supplierId === r.supplier.id)!.excludedReason,
    ).toBe("previously_declined_or_failed");
    expect((await orders.getOrderForActor(h.ctx(SYSTEM), r.orderId)).status).toBe("ROUTING");
  });

  it("expires unanswered offers after the SLA", async () => {
    const r = await routedToOffer();
    h.clock.advance(5 * 3600 * 1000);
    expect(await routing.expireOffers(h.d, h.ctx(SYSTEM))).toBe(1);
    await expect(
      routing.respondToOffer(h.d, h.ctx(r.partner), r.offerId, { accept: true }),
    ).rejects.toThrow("jobs.offer_not_pending");
  });

  it("does not let one supplier act on another supplier's offer", async () => {
    const r = await routedToOffer();
    const other = await h.db.select().from(schema.suppliers);
    const otherSupplier = other.find((s) => s.id !== r.supplier.id)!;
    const intruder = await h.signIn(otherSupplier.contactEmail, "supplier");
    await expect(
      routing.respondToOffer(h.d, h.ctx(intruder), r.offerId, { accept: true }),
    ).rejects.toThrow("auth.forbidden");
  });

  it("fails QC, reprints, and escalates on the second failure", async () => {
    const r = await routedToOffer();
    await routing.respondToOffer(h.d, h.ctx(r.partner), r.offerId, { accept: true });
    const qc = await h.signIn("qc@mfg.local", "admin");
    const runAttempt = async () => {
      const [job] = await h.db
        .select()
        .from(schema.productionJobs)
        .where(eq(schema.productionJobs.status, "ACCEPTED"));
      await production.startProduction(h.ctx(r.partner), job!.id);
      const card = await production.jobCard(h.ctx(r.partner), job!.id);
      await production.submitEvidence(h.ctx(r.partner), job!.id, {
        photoFileIds: [
          await h.uploadPhoto(r.partner, "qc_photo"),
          await h.uploadPhoto(r.partner, "qc_photo"),
        ],
        measurements: card.qc.measurements.map((m) => ({
          name: m.name,
          measuredMm: m.expectedMm + 3,
        })),
        checklist: Object.fromEntries(production.QC_CHECKLIST.map((c) => [c, true])),
      });
      await production.reviewQc(h.ctx(qc), job!.id, {
        verdict: "fail",
        defects: [{ code: "dimension_out_of_tolerance", severity: "major" }],
      });
      return job!;
    };
    const first = await runAttempt();
    expect((await orders.getOrderForActor(h.ctx(SYSTEM), r.orderId)).status).toBe("QC_FAILED");
    await production.orderReprint(h.ctx(qc), first.id, {
      reasonCode: "dimension_out_of_tolerance",
      costBearer: "supplier",
    });
    const order = await orders.getOrderForActor(h.ctx(SYSTEM), r.orderId);
    expect(order.status).toBe("REPRINT_REQUIRED");
    const [reprintJob] = await h.db
      .select()
      .from(schema.productionJobs)
      .where(eq(schema.productionJobs.status, "ACCEPTED"));
    expect(reprintJob!.attemptNo).toBe(2);
    expect(reprintJob!.payoutMinor).toBe(0);
    await runAttempt();
    const escalated = await orders.getOrderForActor(h.ctx(SYSTEM), r.orderId);
    expect(escalated.onHold).toBe(true);
    expect(escalated.holdReason).toBe("qc_failed_twice");
  });
});

describe("authorization probes (IDOR)", () => {
  it("hides other customers' orders and files", async () => {
    const q = await quotedOrder(h, "owner@example.com");
    const stranger = await h.signIn("stranger@example.com");
    await expect(orders.getOrderForActor(h.ctx(stranger), q.orderId)).rejects.toThrow(
      "common.not_found",
    );
    const { getDownloadUrl } = await import("../../src/modules/files/service");
    await expect(getDownloadUrl(h.d, h.ctx(stranger), q.fileId, "probe")).rejects.toThrow(
      "auth.forbidden",
    );
    await expect(
      payments.startCheckout(h.d, h.ctx(stranger), q.orderId, {
        address: ADDRESS,
        idempotencyKey: "s",
        locale: "en",
      }),
    ).rejects.toThrow("common.not_found");
  });

  it("does not give suppliers the customer's files before they accept a job", async () => {
    const q = await quotedOrder(h);
    const partner = await h.signIn("partner1@mfg.local", "supplier");
    const { getDownloadUrl } = await import("../../src/modules/files/service");
    await expect(getDownloadUrl(h.d, h.ctx(partner), q.fileId, "probe")).rejects.toThrow(
      "auth.forbidden",
    );
  });
});
