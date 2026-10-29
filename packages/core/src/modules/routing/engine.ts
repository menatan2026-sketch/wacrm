import { createHash } from "node:crypto";
import type { RoutingCandidate } from "@mfg/db";

export interface RoutingWeights {
  quality: number;
  onTime: number;
  acceptance: number;
  reprint: number;
  cost: number;
  load: number;
}

export const DEFAULT_ROUTING_WEIGHTS: RoutingWeights = {
  quality: 0.3,
  onTime: 0.2,
  acceptance: 0.1,
  reprint: 0.15,
  cost: 0.15,
  load: 0.1,
};

export interface RoutingMachine {
  status: string;
  buildMm: [number, number, number];
  materialVariantIds: string[];
  dailyCapacityMinutes: number;
}

export interface RoutingSupplier {
  id: string;
  name: string;
  status: string;
  machines: RoutingMachine[];
  stats: { qualityScore: number; onTimeRate: number; acceptanceRate: number; reprintRate: number };
  /** Minutes already committed in the window before the due date. */
  committedMinutes: number;
  payoutMinor: number;
  leadTimeDays: number;
}

export interface RoutingRequest {
  orderId: string;
  materialVariantId: string;
  bboxMm: [number, number, number];
  printMinutes: number;
  workingDaysUntilDue: number;
  excludedSupplierIds: string[];
}

/** True when the part fits the build volume in any of the 6 axis orientations (5 mm margin). */
export function fitsBuildVolume(
  part: [number, number, number],
  build: [number, number, number],
  marginMm = 5,
): boolean {
  const [a, b, c] = part;
  const orientations: [number, number, number][] = [
    [a, b, c],
    [a, c, b],
    [b, a, c],
    [b, c, a],
    [c, a, b],
    [c, b, a],
  ];
  return orientations.some(
    ([x, y, z]) => x + marginMm <= build[0] && y + marginMm <= build[1] && z + marginMm <= build[2],
  );
}

const tieBreak = (orderId: string, supplierId: string) =>
  createHash("sha256").update(`${orderId}:${supplierId}`).digest().readUInt32BE(0);

/**
 * Deterministic routing (MASTER_PLAN §15): hard filters, then a weighted score in [0,1].
 * Returns every candidate with its score components or exclusion reason, best first.
 */
export function rankSuppliers(
  req: RoutingRequest,
  suppliers: RoutingSupplier[],
  weights: RoutingWeights,
): RoutingCandidate[] {
  type Eligible = { supplier: RoutingSupplier; free: number; capacity: number; tie: number };
  const eligible: Eligible[] = [];
  const excluded: RoutingCandidate[] = [];
  for (const s of suppliers) {
    const exclude = (reason: string) =>
      excluded.push({ supplierId: s.id, supplierName: s.name, excludedReason: reason });
    if (s.status !== "active") {
      exclude("not_active");
      continue;
    }
    if (req.excludedSupplierIds.includes(s.id)) {
      exclude("previously_declined_or_failed");
      continue;
    }
    const capable = s.machines.filter(
      (m) => m.status === "active" && m.materialVariantIds.includes(req.materialVariantId),
    );
    if (capable.length === 0) {
      exclude("material_unavailable");
      continue;
    }
    const fitting = capable.filter((m) => fitsBuildVolume(req.bboxMm, m.buildMm));
    if (fitting.length === 0) {
      exclude("part_too_large");
      continue;
    }
    if (s.leadTimeDays > req.workingDaysUntilDue) {
      exclude("lead_time_too_long");
      continue;
    }
    const capacity =
      fitting.reduce((sum, m) => sum + m.dailyCapacityMinutes, 0) *
      Math.max(req.workingDaysUntilDue, 1);
    const free = capacity - s.committedMinutes;
    if (free < req.printMinutes) {
      exclude("no_capacity");
      continue;
    }
    eligible.push({ supplier: s, free, capacity, tie: tieBreak(req.orderId, s.id) });
  }

  // Cost is relative: the cheapest eligible supplier scores 1, the most expensive 0.
  const payouts = eligible.map((e) => e.supplier.payoutMinor);
  const min = Math.min(...payouts);
  const max = Math.max(...payouts);
  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const scored = eligible.map((e) => {
    const s = e.supplier;
    const components: Record<keyof RoutingWeights, number> = {
      quality: s.stats.qualityScore,
      onTime: s.stats.onTimeRate,
      acceptance: s.stats.acceptanceRate,
      reprint: 1 - s.stats.reprintRate,
      cost: max === min ? 1 : (max - s.payoutMinor) / (max - min),
      load: Math.max(0, Math.min(1, e.free / e.capacity)),
    };
    const raw = (Object.keys(weights) as (keyof RoutingWeights)[]).reduce(
      (sum, k) => sum + weights[k] * components[k],
      0,
    );
    return {
      candidate: {
        supplierId: s.id,
        supplierName: s.name,
        score: Number((raw / weightTotal).toFixed(4)),
        components,
      },
      tie: e.tie,
    };
  });
  scored.sort((a, b) => b.candidate.score - a.candidate.score || a.tie - b.tie);
  return [...scored.map((s) => s.candidate), ...excluded];
}
