import type { SearchCriteria, SortKey, Vehicle } from "@/domain/types";
import { colorFamily } from "./parse-query";

export interface SearchResult {
  vehicle: Vehicle;
  score: number;
  /** Criteria the vehicle matches, for "why this result" hints. */
  matched: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Hard filters + a soft relevance score. Hard filters exclude; soft
 * signals (spec keywords, colour when not strictly required) only rank.
 */
export function searchVehicles(
  vehicles: Vehicle[],
  criteria: Partial<SearchCriteria>,
  sort: SortKey = "recommended",
): SearchResult[] {
  const results: SearchResult[] = [];

  for (const v of vehicles) {
    const matched: string[] = [];
    let score = 0;

    if (criteria.make) {
      const makeHit =
        norm(v.make) === norm(criteria.make) ||
        // "Mercedes-Benz" search should include AMG / Maybach cars.
        norm(v.make).startsWith(norm(criteria.make.split("-")[0]));
      if (!makeHit) continue;
      matched.push("make");
      score += 3;
    }
    if (criteria.model) {
      const a = norm(v.model);
      const b = norm(criteria.model);
      if (!(a.includes(b) || b.includes(a))) continue;
      matched.push("model");
      score += 5;
    }
    if (criteria.yearMin && v.year < criteria.yearMin) continue;
    if (criteria.yearMax && v.year > criteria.yearMax) continue;
    if (criteria.budgetMaxILS && v.estimatedLandedPriceILS > criteria.budgetMaxILS) continue;
    if (criteria.mileageMaxKm && v.mileageKm > criteria.mileageMaxKm) continue;
    if (criteria.fuel && v.engine.fuel !== criteria.fuel) continue;
    if (criteria.transmission && v.transmission !== criteria.transmission) continue;
    if (criteria.drivetrain) {
      const ok = criteria.drivetrain === "awd" ? v.drivetrain === "awd" || v.drivetrain === "4wd" : v.drivetrain === criteria.drivetrain;
      if (!ok) continue;
    }
    if (criteria.bodyType && v.bodyType !== criteria.bodyType) continue;
    if (criteria.countryCode && v.location.countryCode !== criteria.countryCode) continue;
    if (criteria.engine) {
      const e = norm(criteria.engine);
      if (!norm(v.engine.label).includes(e)) continue;
    }
    if (criteria.color) {
      if (colorFamily(v.exterior.name) !== criteria.color) continue;
      matched.push("color");
      score += 2;
    }
    if (criteria.spec?.length) {
      for (const s of criteria.spec) {
        if (v.tags.includes(s)) {
          matched.push(s);
          score += 1.5;
        }
      }
    }
    if (criteria.text) {
      const hay = norm([v.make, v.model, v.variant, v.exterior.name, v.interior, ...v.options].join(" "));
      const words = criteria.text.split(/\s+/).map(norm).filter((w) => w.length > 2);
      for (const w of words) if (hay.includes(w)) score += 1;
    }

    // Recommended: available stock first, then freshness.
    if (v.status === "available") score += 1;
    score += Math.max(0, 1 - (Date.now() - Date.parse(v.listedAt)) / (1000 * 60 * 60 * 24 * 120));

    results.push({ vehicle: v, score, matched });
  }

  const cmp: Record<SortKey, (a: SearchResult, b: SearchResult) => number> = {
    recommended: (a, b) => b.score - a.score,
    "price-asc": (a, b) => a.vehicle.estimatedLandedPriceILS - b.vehicle.estimatedLandedPriceILS,
    "price-desc": (a, b) => b.vehicle.estimatedLandedPriceILS - a.vehicle.estimatedLandedPriceILS,
    "year-desc": (a, b) => b.vehicle.year - a.vehicle.year,
    "mileage-asc": (a, b) => a.vehicle.mileageKm - b.vehicle.mileageKm,
  };
  return results.sort(cmp[sort]);
}

/** Criteria ⇄ URL search params, so every search is shareable. */
export function criteriaToParams(c: Partial<SearchCriteria>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(c)) {
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  return p;
}

const NUMERIC = new Set(["yearMin", "yearMax", "budgetMaxILS", "mileageMaxKm"]);

export function paramsToCriteria(p: URLSearchParams | Record<string, string | string[] | undefined>): Partial<SearchCriteria> {
  const get = (k: string) => {
    if (p instanceof URLSearchParams) return p.get(k) ?? undefined;
    const v = p[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const out: Record<string, unknown> = {};
  for (const k of [
    "make", "model", "yearMin", "yearMax", "budgetMaxILS", "mileageMaxKm", "engine", "fuel",
    "transmission", "drivetrain", "bodyType", "countryCode", "color", "spec", "text",
  ]) {
    const v = get(k);
    if (!v) continue;
    if (NUMERIC.has(k)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    } else if (k === "spec") out[k] = v.split(",").filter(Boolean);
    else out[k] = v;
  }
  return out as Partial<SearchCriteria>;
}
