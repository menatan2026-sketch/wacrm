import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculatePrice, snapshotHash, type PricingInput } from "../src/modules/pricing/engine";
import { DEFAULT_FDM_RULES, pricingRulesSchema } from "../src/modules/pricing/rules";
import { taxFromGross } from "../src/shared/money";

const cube = (side: number, qty = 1, material = "PLA"): PricingInput["items"][number] => ({
  volumeMm3: side ** 3,
  surfaceAreaMm2: 6 * side ** 2,
  overhangAreaMm2: 0,
  bboxMm: [side, side, side],
  materialCode: material,
  densityGCm3: 1.24,
  qualityProfile: "standard",
  quantity: qty,
});
const input = (o: Partial<PricingInput> = {}): PricingInput => ({
  items: [cube(40)],
  urgency: "standard",
  includeShipping: true,
  taxRateBps: 1800,
  ...o,
});
const rules = DEFAULT_FDM_RULES;

describe("pricing engine", () => {
  it("default rules are valid", () => {
    expect(pricingRulesSchema.safeParse(rules).success).toBe(true);
  });

  it("is deterministic", () => {
    expect(calculatePrice(input(), rules)).toEqual(calculatePrice(input(), rules));
    expect(snapshotHash(calculatePrice(input(), rules))).toBe(
      snapshotHash(calculatePrice(input(), rules)),
    );
  });

  it("produces integer money whose lines sum to the net subtotal and whose VAT is consistent", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 250 }),
        fc.integer({ min: 1, max: 60 }),
        fc.constantFrom("standard", "fast", "urgent"),
        fc.boolean(),
        (side, qty, urgency, ship) => {
          const p = calculatePrice(
            input({
              items: [cube(side, qty)],
              urgency: urgency as PricingInput["urgency"],
              includeShipping: ship,
            }),
            rules,
          );
          for (const v of [
            p.totalMinor,
            p.taxMinor,
            p.subtotalNetMinor,
            p.expectedPayoutMinor,
            ...p.lines.map((l) => l.amountNetMinor),
          ]) {
            expect(Number.isInteger(v)).toBe(true);
          }
          expect(p.lines.reduce((s, l) => s + l.amountNetMinor, 0)).toBe(p.subtotalNetMinor);
          expect(p.subtotalNetMinor + p.taxMinor).toBe(p.totalMinor);
          expect(p.taxMinor).toBe(taxFromGross(p.totalMinor, 1800));
          expect(p.totalMinor % rules.grossRoundingMinor).toBe(0);
        },
      ),
    );
  });

  it("never decreases when the part gets bigger", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 200 }),
        fc.integer({ min: 1, max: 50 }),
        (side, grow) => {
          const small = calculatePrice(input({ items: [cube(side)] }), rules).totalMinor;
          const big = calculatePrice(input({ items: [cube(side + grow)] }), rules).totalMinor;
          expect(big).toBeGreaterThanOrEqual(small);
        },
      ),
    );
  });

  it("charges more for urgency and adds a separate urgency line", () => {
    const std = calculatePrice(input({ items: [cube(80)] }), rules);
    const urgent = calculatePrice(input({ items: [cube(80)], urgency: "urgent" }), rules);
    expect(urgent.totalMinor).toBeGreaterThan(std.totalMinor);
    expect(urgent.lines.some((l) => l.kind === "urgency")).toBe(true);
    expect(urgent.leadDays).toBeLessThan(std.leadDays);
  });

  it("gives a per-unit quantity discount", () => {
    const one = calculatePrice(input({ items: [cube(60, 1)], includeShipping: false }), rules);
    const twenty = calculatePrice(input({ items: [cube(60, 20)], includeShipping: false }), rules);
    expect(twenty.subtotalNetMinor / 20).toBeLessThan(one.subtotalNetMinor);
  });

  it("applies the minimum order value to tiny parts", () => {
    const p = calculatePrice(input({ items: [cube(5)], includeShipping: false }), rules);
    expect(p.subtotalNetMinor).toBeGreaterThanOrEqual(
      rules.minOrderNetMinor - rules.grossRoundingMinor,
    );
  });

  it("flags review for oversized parts and quantities above the auto limit", () => {
    expect(calculatePrice(input({ items: [cube(320)] }), rules).reviewReasons).toContain(
      "part_too_large",
    );
    expect(calculatePrice(input({ items: [cube(20, 51)] }), rules).reviewReasons).toContain(
      "quantity_above_auto_limit",
    );
  });

  it("flags review when the margin falls below the floor", () => {
    const thin = { ...rules, targetMarginBps: 500 };
    expect(calculatePrice(input({ items: [cube(120)] }), thin).reviewReasons).toContain(
      "margin_below_floor",
    );
  });

  it("keeps a healthy margin on a typical part with default rules", () => {
    const p = calculatePrice(input({ items: [cube(60, 2)] }), rules);
    expect(p.reviewReasons).toEqual([]);
    expect(p.marginBps).toBeGreaterThanOrEqual(rules.autoQuote.minMarginBps);
  });

  it("keeps the margin above the floor for small parts in small quantities (setup cost priced in)", () => {
    for (const side of [10, 20, 40]) {
      for (const qty of [1, 2, 3]) {
        const p = calculatePrice(input({ items: [cube(side, qty)] }), rules);
        expect(p.reviewReasons, `${side}mm x${qty}`).not.toContain("margin_below_floor");
      }
    }
  });

  it("rejects invalid quantities", () => {
    expect(() => calculatePrice(input({ items: [cube(20, 0)] }), rules)).toThrow();
    expect(() => calculatePrice(input({ items: [cube(20, 1.5)] }), rules)).toThrow();
  });
});
