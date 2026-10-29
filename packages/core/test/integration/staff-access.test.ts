import { schema, eq } from "@mfg/db";
import { beforeEach, describe, expect, it } from "vitest";
import * as admin from "../../src/modules/admin/service";
import * as routing from "../../src/modules/routing/service";
import * as payments from "../../src/modules/payments/service";
import * as production from "../../src/modules/production/service";
import * as quotes from "../../src/modules/quotes/service";
import { SYSTEM } from "../../src/shared/context";
import { queryAudit } from "../../src/platform/audit";
import { listFlags, setFlag } from "../../src/platform/flags";
import { quotedOrder } from "./fixtures";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeEach(async () => {
  h = await createHarness();
});

describe("server-side RBAC on platform controls", () => {
  it("only roles with flags.manage can read or change feature flags", async () => {
    const qc = h.ctx(await h.signIn("qc@mfg.local", "admin"));
    await expect(setFlag(qc, "AUTO_ROUTING", true, "test")).rejects.toThrow("auth.forbidden");
    await expect(listFlags(qc)).rejects.toThrow("auth.forbidden");
    const adminCtx = h.ctx(await h.signIn("admin@mfg.local", "admin"));
    await setFlag(adminCtx, "AUTO_ROUTING", true, "pilot");
    expect((await listFlags(adminCtx)).find((f) => f.key === "AUTO_ROUTING")?.enabled).toBe(true);
  });

  it("only roles with audit.read can query the audit log", async () => {
    const support = h.ctx(await h.signIn("support@mfg.local", "admin"));
    await expect(queryAudit(support, {})).rejects.toThrow("auth.forbidden");
    const finance = h.ctx(await h.signIn("finance@mfg.local", "admin"));
    expect(Array.isArray(await queryAudit(finance, { limit: 5 }))).toBe(true);
  });

  it("order detail and payout overview are staff-only", async () => {
    const q = await quotedOrder(h);
    const customer = h.ctx(await h.signIn("dana@example.com"));
    await expect(admin.orderDetail(customer, q.orderId)).rejects.toThrow("auth.forbidden");
    await expect(admin.payoutOverview(customer)).rejects.toThrow("auth.forbidden");
    const support = h.ctx(await h.signIn("support@mfg.local", "admin"));
    expect((await admin.orderDetail(support, q.orderId)).order.id).toBe(q.orderId);
    await expect(admin.payoutOverview(support)).rejects.toThrow("auth.forbidden");
  });
});

describe("partner views", () => {
  it("offers and jobs carry a part summary without customer data", async () => {
    const q = await quotedOrder(h);
    const { checkoutUrl } = await payments.startCheckout(h.d, h.ctx(q.customer), q.orderId, { address: { recipientName: "Dana Cohen", phone: "050-0000000", line1: "Herzl 1", city: "Haifa" }, idempotencyKey: "k1", locale: "en" });
    const quote = await quotes.currentQuote(h.ctx(SYSTEM), q.orderId);
    const hook = h.payments.buildWebhook({ providerEventId: "evt-1", type: "payment.captured", providerRef: checkoutUrl.split("/").pop()!, amountMinor: quote!.snapshot.totalMinor, currency: "ILS" });
    await payments.handlePaymentWebhook(h.d, hook.body, hook.headers);
    await h.drain();
    const adminActor = await h.signIn("admin@mfg.local", "admin");
    const [decision] = await routing.routingDecisions(h.ctx(adminActor), q.orderId);
    const supplierId = decision!.chosenSupplierId!;
    const offerId = await routing.offerToSupplier(h.d, h.ctx(adminActor), q.orderId, supplierId, "manual_confirmed");
    const [supplier] = await h.db.select().from(schema.suppliers).where(eq(schema.suppliers.id, supplierId));
    const partner = h.ctx(await h.signIn(supplier!.contactEmail!, "supplier"));

    const [offer] = await routing.supplierOffers(partner, supplierId);
    expect(offer!.offer.id).toBe(offerId);
    expect(offer!.part).toMatchObject({ quantity: 2, materialCode: "PLA" });
    expect(offer!.part.sizeMm).toHaveLength(3);
    expect(JSON.stringify(offer)).not.toMatch(/dana@example\.com|Herzl/);

    await routing.respondToOffer(h.d, partner, offerId!, { accept: true });
    const [job] = await production.supplierJobs(partner, supplierId);
    expect(job!.part.materialCode).toBe("PLA");
    expect(JSON.stringify(job)).not.toMatch(/dana@example\.com|Herzl/);
  });

  it("hides offers whose response window has passed even before the sweeper runs", async () => {
    const supplier = await h.signIn("partner1@mfg.local", "supplier");
    const supplierId = supplier.roles.find((r) => r.scopeType === "supplier")!.scopeId!;
    h.clock.advance(365 * 24 * 3600 * 1000);
    expect(await routing.supplierOffers(h.ctx(supplier), supplierId)).toEqual([]);
  });
});
