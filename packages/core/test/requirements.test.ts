import { describe, expect, it } from "vitest";
import {
  deriveRequirements,
  missingUsage,
  recommendMaterials,
  type MaterialCandidate,
} from "../src/modules/requirements/rules";

const M = (code: string, o: Partial<MaterialCandidate>): MaterialCandidate => ({
  id: code,
  code,
  maxServiceTempC: 52,
  uvResistance: 1,
  moistureResistance: 2,
  flexibility: "rigid",
  strengthIndex: 2,
  foodContactCertifiable: false,
  costTier: 1,
  sort: 0,
  ...o,
});
const CATALOG = [
  M("PLA", { sort: 1 }),
  M("PETG", {
    maxServiceTempC: 70,
    uvResistance: 2,
    moistureResistance: 3,
    flexibility: "slight",
    strengthIndex: 3,
    sort: 2,
  }),
  M("ABS", { maxServiceTempC: 90, strengthIndex: 3, costTier: 2 }),
  M("ASA", {
    maxServiceTempC: 90,
    uvResistance: 3,
    moistureResistance: 3,
    strengthIndex: 3,
    costTier: 2,
  }),
  M("TPU_95A", {
    maxServiceTempC: 60,
    uvResistance: 2,
    moistureResistance: 3,
    flexibility: "rubber",
    costTier: 3,
  }),
  M("PA_CF", {
    maxServiceTempC: 120,
    uvResistance: 2,
    moistureResistance: 1,
    strengthIndex: 5,
    costTier: 4,
  }),
];
const base = {
  environment: "indoor",
  heat: "none",
  load: "none",
  flexibility: "rigid",
  appearance: "clean",
} as const;
const codes = (u: Parameters<typeof deriveRequirements>[0]) =>
  recommendMaterials(CATALOG, deriveRequirements(u)).map((m) => m.code);

describe("requirements → recommendation", () => {
  it("reports missing usage answers", () => {
    expect(missingUsage({ heat: "none" })).toEqual([
      "environment",
      "load",
      "flexibility",
      "appearance",
    ]);
  });
  it("indoor, no load → cheapest first (PLA)", () => {
    expect(codes(base)[0]).toBe("PLA");
  });
  it("in a car → heat and UV resistant only, cheapest first", () => {
    expect(codes({ ...base, environment: "car" })).toEqual(["ASA", "PA_CF"]);
  });
  it("outdoor → UV and moisture resistant", () => {
    expect(codes({ ...base, environment: "outdoor" })).toEqual(["PETG", "ASA"]);
  });
  it("rubber-like → TPU only", () => {
    expect(codes({ ...base, flexibility: "rubber" })).toEqual(["TPU_95A"]);
  });
  it("heavy load → review, strongest material", () => {
    const r = deriveRequirements({ ...base, load: "heavy" });
    expect(r.reviewReasons).toContain("heavy_load");
    expect(recommendMaterials(CATALOG, r).map((m) => m.code)).toEqual(["PA_CF"]);
  });
  it("food contact → review and no uncertified material", () => {
    const r = deriveRequirements({ ...base, foodContact: true });
    expect(r.reviewReasons).toContain("food_contact");
    expect(recommendMaterials(CATALOG, r)).toEqual([]);
  });
  it("very hot → review even when a material exists", () => {
    const r = deriveRequirements({ ...base, heat: "very_hot" });
    expect(r.reviewReasons).toContain("very_high_temperature");
    expect(recommendMaterials(CATALOG, r).map((m) => m.code)).toEqual(["PA_CF"]);
  });
  it("maps appearance to the quality profile", () => {
    expect(deriveRequirements({ ...base, appearance: "showpiece" }).qualityProfile).toBe("fine");
    expect(deriveRequirements({ ...base, appearance: "functional" }).qualityProfile).toBe("draft");
  });
});
