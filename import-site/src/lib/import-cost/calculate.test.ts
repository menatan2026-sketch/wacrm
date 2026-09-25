import { describe, expect, it } from "vitest";
import { importRules } from "@/config/import-rules";
import { calculateImportCost } from "./calculate";

const base = {
  price: 100_000,
  currency: "EUR" as const,
  exchangeRate: 4,
  countryCode: "DE",
  year: new Date().getFullYear(),
  engineCc: 2998,
  fuel: "petrol" as const,
  vehicleType: "passenger" as const,
  shipping: "roro" as const,
};

describe("calculateImportCost", () => {
  it("sums its lines into the total", () => {
    const r = calculateImportCost(base);
    expect(r.totalILS).toBe(r.lines.reduce((s, l) => s + l.amountILS, 0));
    expect(r.range[0]).toBeLessThan(r.totalILS);
    expect(r.range[1]).toBeGreaterThan(r.totalILS);
  });

  it("charges no customs duty for trade-agreement origins", () => {
    const de = calculateImportCost(base);
    const jp = calculateImportCost({ ...base, countryCode: "JP", currency: "JPY", exchangeRate: 4 });
    expect(de.lines.find((l) => l.key === "customs")!.amountILS).toBe(0);
    expect(jp.lines.find((l) => l.key === "customs")!.amountILS).toBeGreaterThan(0);
  });

  it("applies the lower electric purchase-tax band", () => {
    const petrol = calculateImportCost(base).lines.find((l) => l.key === "purchaseTax")!.amountILS;
    const ev = calculateImportCost({ ...base, fuel: "electric", engineCc: null }).lines.find((l) => l.key === "purchaseTax")!.amountILS;
    expect(ev / petrol).toBeCloseTo(importRules.purchaseTaxRate.electric / importRules.purchaseTaxRate.petrol, 2);
  });

  it("only charges luxury tax above the threshold", () => {
    const cheap = calculateImportCost({ ...base, price: 20_000 });
    expect(cheap.lines.find((l) => l.key === "luxuryTax")!.amountILS).toBe(0);
    const dear = calculateImportCost({ ...base, price: 300_000 });
    expect(dear.lines.find((l) => l.key === "luxuryTax")!.amountILS).toBeGreaterThan(0);
  });
});
