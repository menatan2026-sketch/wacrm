import type { QcMeasurement } from "@mfg/db";
import type { Ctx } from "../../shared/context";
import { currentQuote } from "../quotes/service";

export const QC_CHECKLIST = [
  "no_warping",
  "no_layer_shift",
  "surface_ok",
  "color_matches",
  "quantity_correct",
] as const;

/** FDM tolerance used for QC measurements: ±0.5 mm or ±1 %, whichever is larger. */
export const toleranceFor = (mm: number) => Math.round(Math.max(0.5, mm * 0.01) * 100) / 100;

/** The measurements a supplier must report, generated from the dimensions frozen in the quote. */
export async function qcRequirements(
  ctx: Ctx,
  orderId: string,
): Promise<{ measurements: QcMeasurement[]; checklist: readonly string[] }> {
  const quote = await currentQuote(ctx, orderId);
  const items =
    (quote?.snapshot.inputs as {
      items?: { bboxMm: [number, number, number] }[];
      engineInput?: { items?: { bboxMm: [number, number, number] }[] };
    }) ?? {};
  const bbox = items.items?.[0]?.bboxMm ?? items.engineInput?.items?.[0]?.bboxMm;
  const measurements: QcMeasurement[] = bbox
    ? (["x", "y", "z"] as const).map((axis, i) => ({
        name: axis,
        expectedMm: Math.round(bbox[i]! * 10) / 10,
        toleranceMm: toleranceFor(bbox[i]!),
      }))
    : [];
  return { measurements, checklist: QC_CHECKLIST };
}
