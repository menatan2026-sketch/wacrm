import { describe, expect, it } from "vitest";
import { DEFAULT_ROUTING_WEIGHTS, fitsBuildVolume, rankSuppliers, type RoutingSupplier } from "../src/modules/routing/engine";

const sup = (id: string, o: Partial<RoutingSupplier> = {}): RoutingSupplier => ({
  id,
  name: id,
  status: "active",
  machines: [{ status: "active", buildMm: [250, 210, 220], materialVariantIds: ["pla-black"], dailyCapacityMinutes: 1200 }],
  stats: { qualityScore: 0.8, onTimeRate: 0.9, acceptanceRate: 0.9, reprintRate: 0.02 },
  committedMinutes: 0,
  payoutMinor: 5000,
  leadTimeDays: 2,
  ...o,
});
const req = { orderId: "o1", materialVariantId: "pla-black", bboxMm: [100, 50, 30] as [number, number, number], printMinutes: 300, workingDaysUntilDue: 5, excludedSupplierIds: [] };

describe("fitsBuildVolume", () => {
  it("considers all orientations", () => {
    expect(fitsBuildVolume([300, 100, 100], [250, 310, 220])).toBe(true);
    expect(fitsBuildVolume([300, 300, 100], [250, 210, 220])).toBe(false);
  });
});

describe("rankSuppliers", () => {
  it("excludes with a reason for every hard filter", () => {
    const ranked = rankSuppliers({ ...req, excludedSupplierIds: ["declined"] }, [
      sup("paused", { status: "paused" }),
      sup("declined"),
      sup("no-material", { machines: [{ status: "active", buildMm: [250, 210, 220], materialVariantIds: ["petg"], dailyCapacityMinutes: 1200 }] }),
      sup("small", { machines: [{ status: "active", buildMm: [80, 80, 80], materialVariantIds: ["pla-black"], dailyCapacityMinutes: 1200 }] }),
      sup("slow", { leadTimeDays: 9 }),
      sup("busy", { committedMinutes: 6000 }),
      sup("ok"),
    ], DEFAULT_ROUTING_WEIGHTS);
    const reasons = Object.fromEntries(ranked.map((c) => [c.supplierId, c.excludedReason]));
    expect(reasons).toEqual({
      ok: undefined,
      paused: "not_active",
      declined: "previously_declined_or_failed",
      "no-material": "material_unavailable",
      small: "part_too_large",
      slow: "lead_time_too_long",
      busy: "no_capacity",
    });
    expect(ranked[0]!.supplierId).toBe("ok");
  });

  it("prefers higher quality and lower payout according to the weights", () => {
    const ranked = rankSuppliers(req, [
      sup("cheap-good", { payoutMinor: 4000, stats: { qualityScore: 0.95, onTimeRate: 0.95, acceptanceRate: 0.9, reprintRate: 0 } }),
      sup("pricey-poor", { payoutMinor: 9000, stats: { qualityScore: 0.6, onTimeRate: 0.7, acceptanceRate: 0.9, reprintRate: 0.1 } }),
    ], DEFAULT_ROUTING_WEIGHTS);
    expect(ranked.map((c) => c.supplierId)).toEqual(["cheap-good", "pricey-poor"]);
    expect(ranked[0]!.components).toMatchObject({ cost: 1, quality: 0.95 });
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score!);
  });

  it("breaks ties deterministically", () => {
    const a = rankSuppliers(req, [sup("a"), sup("b"), sup("c")], DEFAULT_ROUTING_WEIGHTS).map((c) => c.supplierId);
    const b = rankSuppliers(req, [sup("c"), sup("a"), sup("b")], DEFAULT_ROUTING_WEIGHTS).map((c) => c.supplierId);
    expect(a).toEqual(b);
  });
});
