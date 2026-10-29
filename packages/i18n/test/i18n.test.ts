import { describe, expect, it } from "vitest";
import { checkCatalogs } from "../scripts/check-catalogs";
import { directionOf, formatLength, formatMoney, negotiateLocale, parseDecimal, toMm, translate } from "../src/index";

const nbsp = (s: string) => s.replace(/[  ‏‎]/g, " ");

describe("formatMoney", () => {
  it("formats ILS per locale without manual symbol concatenation", () => {
    expect(nbsp(formatMoney(123450, "ILS", "en"))).toBe("₪1,234.50");
    expect(nbsp(formatMoney(123450, "ILS", "ru"))).toBe("1 234,50 ₪");
    expect(nbsp(formatMoney(123450, "ILS", "he"))).toContain("1,234.50");
    expect(formatMoney(123450, "ILS", "he")).toContain("₪");
  });
});

describe("parseDecimal", () => {
  it.each([
    ["12.5", 12.5],
    ["12,5", 12.5],
    [" 1 200,75 ", 1200.75],
    ["7", 7],
  ])("parses %s", (input, expected) => expect(parseDecimal(input)).toBe(expected));

  it.each(["", "abc", "1,2,3", "1.2.3", "--1"])("rejects %s", (input) => expect(parseDecimal(input)).toBeNull());
});

describe("units", () => {
  it("converts inches", () => {
    expect(toMm(2, "in")).toBeCloseTo(50.8);
    expect(formatLength(50.8, "in", "en")).toBe("2");
  });
});

describe("locale negotiation", () => {
  it("prefers the highest-ranked supported language", () => {
    expect(negotiateLocale("fr-FR,ru;q=0.9,en;q=0.8")).toBe("ru");
    expect(negotiateLocale("iw-IL")).toBe("he");
    expect(negotiateLocale("de")).toBe("he");
    expect(negotiateLocale(null)).toBe("he");
  });
  it("knows Hebrew is RTL", () => {
    expect(directionOf("he")).toBe("rtl");
    expect(directionOf("ru")).toBe("ltr");
  });
});

describe("translate", () => {
  it("interpolates and pluralizes per locale", () => {
    expect(translate("en", "common.units.days", { n: 1 })).toBe("1 day");
    expect(translate("he", "common.units.days", { n: 2 })).toBe("יומיים");
    expect(translate("ru", "common.units.days", { n: 5 })).toBe("5 дней");
    expect(translate("ru", "common.units.days", { n: 3 })).toBe("3 дня");
  });
  it("throws on a missing key instead of shipping English", () => {
    expect(() => translate("he", "common.nope")).toThrow(/missing message/);
  });
});

describe("catalogs", () => {
  it("are complete and consistent across he/en/ru", () => {
    expect(checkCatalogs()).toEqual([]);
  });
});
