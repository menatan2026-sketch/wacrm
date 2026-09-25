import { describe, expect, it } from "vitest";
import { parseQuery } from "./parse-query";

describe("parseQuery", () => {
  it("structures the canonical G63 request", () => {
    const { criteria } = parseQuery(
      "2025 Mercedes-AMG G63\nblack\nunder 1.2M NIS\nlow mileage\nfull specification",
    );
    expect(criteria).toMatchObject({
      yearMin: 2025,
      yearMax: 2025,
      make: "Mercedes-AMG",
      model: "G 63",
      color: "black",
      budgetMaxILS: 1_200_000,
      mileageMaxKm: 20_000,
    });
    expect(criteria.spec).toEqual(expect.arrayContaining(["full-spec", "low-mileage"]));
  });

  it("keeps AMG make when the user types plain 'mercedes'", () => {
    expect(parseQuery("mercedes g wagon").criteria).toMatchObject({ make: "Mercedes-AMG", model: "G 63" });
  });

  it("reads euro budgets, year ranges and explicit mileage", () => {
    const { criteria } = parseQuery("porsche 911 gt3 rs 2022-2024 under €300k less than 10,000 km weissach");
    expect(criteria.make).toBe("Porsche");
    expect(criteria.model).toBe("911 GT3 RS");
    expect(criteria.yearMin).toBe(2022);
    expect(criteria.yearMax).toBe(2024);
    expect(criteria.budgetMaxILS).toBe(Math.round(300_000 * 4.05));
    expect(criteria.mileageMaxKm).toBe(10_000);
    expect(criteria.spec).toContain("weissach");
  });

  it("does not read a mileage figure as a budget", () => {
    const { criteria } = parseQuery("range rover under 20,000 km");
    expect(criteria.budgetMaxILS).toBeUndefined();
    expect(criteria.mileageMaxKm).toBe(20_000);
  });

  it("detects fuel, body, drive and origin", () => {
    const { criteria } = parseQuery("electric awd sedan from the usa 2024+");
    expect(criteria).toMatchObject({ fuel: "electric", drivetrain: "awd", bodyType: "sedan", countryCode: "US", yearMin: 2024 });
  });
});
