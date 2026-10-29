import type { UsageAnswers } from "@mfg/db";

/** Technical constraints derived from plain-language usage answers (UX_ARCHITECTURE §4.3). */
export interface Requirements {
  minServiceTempC: number;
  minUvResistance: number;
  minMoistureResistance: number;
  minStrength: number;
  flexibility: "rigid" | "slight" | "rubber";
  qualityProfile: "draft" | "standard" | "fine";
  foodContact: boolean;
  /** Reasons the request must be reviewed by a person before quoting. */
  reviewReasons: string[];
  /** Human-readable rationale keys (catalog: manufacturing.reasons.*). */
  rationale: string[];
}

export const REQUIRED_USAGE_FIELDS = [
  "environment",
  "heat",
  "load",
  "flexibility",
  "appearance",
] as const;

export function missingUsage(u: UsageAnswers): string[] {
  return REQUIRED_USAGE_FIELDS.filter((f) => u[f] === undefined);
}

export function deriveRequirements(u: UsageAnswers): Requirements {
  const r: Requirements = {
    minServiceTempC: 40,
    minUvResistance: 0,
    minMoistureResistance: 0,
    minStrength: 1,
    flexibility: u.flexibility ?? "rigid",
    qualityProfile: "standard",
    foodContact: u.foodContact === true,
    reviewReasons: [],
    rationale: [],
  };
  switch (u.heat) {
    case "warm":
      r.minServiceTempC = 55;
      r.rationale.push("heat_warm");
      break;
    case "hot":
      r.minServiceTempC = 85;
      r.rationale.push("heat_hot");
      break;
    case "very_hot":
      r.minServiceTempC = 110;
      r.reviewReasons.push("very_high_temperature");
      r.rationale.push("heat_very_hot");
      break;
  }
  switch (u.environment) {
    case "outdoor":
      r.minUvResistance = 2;
      r.minMoistureResistance = 2;
      r.rationale.push("outdoor");
      break;
    case "car":
      r.minUvResistance = 2;
      r.minServiceTempC = Math.max(r.minServiceTempC, 85);
      r.rationale.push("car");
      break;
    case "wet":
      r.minMoistureResistance = 3;
      r.rationale.push("wet");
      break;
  }
  switch (u.load) {
    case "light":
      r.minStrength = 2;
      break;
    case "moderate":
      r.minStrength = 3;
      r.rationale.push("load_moderate");
      break;
    case "heavy":
      r.minStrength = 4;
      r.reviewReasons.push("heavy_load");
      r.rationale.push("load_heavy");
      break;
  }
  if (u.appearance === "showpiece") r.qualityProfile = "fine";
  if (u.appearance === "functional") r.qualityProfile = "draft";
  if (r.foodContact) r.reviewReasons.push("food_contact");
  if (r.flexibility === "rubber") r.rationale.push("flex_rubber");
  return r;
}

export interface MaterialCandidate {
  id: string;
  code: string;
  maxServiceTempC: number;
  uvResistance: number;
  moistureResistance: number;
  flexibility: "rigid" | "slight" | "rubber";
  strengthIndex: number;
  foodContactCertifiable: boolean;
  costTier: number;
  /** Catalog priority set by the business; breaks ties between equally priced materials. */
  sort: number;
}

const FLEX_OK: Record<Requirements["flexibility"], MaterialCandidate["flexibility"][]> = {
  rigid: ["rigid", "slight"],
  slight: ["slight"],
  rubber: ["rubber"],
};

export function materialFits(m: MaterialCandidate, r: Requirements): boolean {
  return (
    m.maxServiceTempC >= r.minServiceTempC &&
    m.uvResistance >= r.minUvResistance &&
    m.moistureResistance >= r.minMoistureResistance &&
    m.strengthIndex >= r.minStrength &&
    FLEX_OK[r.flexibility].includes(m.flexibility) &&
    (!r.foodContact || m.foodContactCertifiable)
  );
}

/**
 * Deterministic recommendation: every material that satisfies the requirements, cheapest first,
 * then by catalog priority. Empty means a person must review the request.
 */
export function recommendMaterials<M extends MaterialCandidate>(
  materials: M[],
  r: Requirements,
): M[] {
  return materials
    .filter((m) => materialFits(m, r))
    .sort((a, b) => a.costTier - b.costTier || a.sort - b.sort || a.code.localeCompare(b.code));
}
