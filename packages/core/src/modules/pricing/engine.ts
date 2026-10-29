import { createHash } from "node:crypto";
import type { QuoteLine } from "@mfg/db";
import { applyBps, roundToStep, taxFromGross } from "../../shared/money";
import type { PricingRules } from "./rules";

export const PRICING_ENGINE_VERSION = "fdm-cost-plus-1";

export interface PricingItemInput {
  /** Geometry already scaled to the confirmed units (mm). */
  volumeMm3: number;
  surfaceAreaMm2: number;
  overhangAreaMm2: number;
  bboxMm: [number, number, number];
  materialCode: string;
  densityGCm3: number;
  qualityProfile: string;
  quantity: number;
}

export interface PricingInput {
  items: PricingItemInput[];
  urgency: "standard" | "fast" | "urgent";
  includeShipping: boolean;
  taxRateBps: number;
  designFeeNetMinor?: number;
}

export interface ItemEstimate {
  massG: number;
  printMinutes: number;
  unitPayoutMinor: number;
  unitNetMinor: number;
  lineNetMinor: number;
}

export interface PriceBreakdown {
  engineVersion: string;
  currency: string;
  items: ItemEstimate[];
  lines: QuoteLine[];
  subtotalNetMinor: number;
  taxMinor: number;
  totalMinor: number;
  expectedPayoutMinor: number;
  expectedMarginMinor: number;
  marginBps: number;
  leadDays: number;
  /** Non-empty when a person must review before the quote is shown (AUTO_PRICING guards). */
  reviewReasons: string[];
}

function estimateItem(item: PricingItemInput, rules: PricingRules) {
  const profile = rules.profiles[item.qualityProfile] ?? rules.profiles.standard;
  if (!profile) throw new Error(`unknown quality profile ${item.qualityProfile}`);
  const shell = Math.min(item.volumeMm3, item.surfaceAreaMm2 * profile.wallThicknessMm);
  const interior = Math.max(item.volumeMm3 - shell, 0);
  const support = item.overhangAreaMm2 * profile.supportFactorMm;
  const massG = (item.densityGCm3 * (shell + interior * profile.infill + support)) / 1000;
  const rate = rules.extrusionRateGPerMin[item.materialCode] ?? rules.extrusionRateGPerMin.default;
  const printMinutes = Math.ceil(
    (massG / rate) * (1 / profile.speedFactor) + item.bboxMm[2] * rules.heightMinutesPerMm,
  );
  const perGram = rules.payout.perGramMinor[item.materialCode] ?? rules.payout.perGramMinor.default;
  const unitPayoutMinor = Math.max(
    rules.payout.minimumMinor,
    Math.round(massG * perGram + printMinutes * rules.payout.perPrintMinuteMinor),
  );
  return { massG, printMinutes, unitPayoutMinor };
}

function quantityMultiplier(qty: number, rules: PricingRules): number {
  return (
    [...rules.quantityBreaks].sort((a, b) => b.minQty - a.minQty).find((b) => qty >= b.minQty)
      ?.multiplierBps ?? 10000
  );
}

/** Deterministic cost-plus price. Same input + same rules ⇒ identical output. */
export function calculatePrice(input: PricingInput, rules: PricingRules): PriceBreakdown {
  if (input.items.length === 0) throw new Error("at least one item is required");
  const reviewReasons: string[] = [];
  const items: ItemEstimate[] = [];
  let manufacturingNet = 0;
  let payout = rules.payout.setupMinor;

  for (const item of input.items) {
    if (!(item.quantity >= 1) || !Number.isInteger(item.quantity))
      throw new Error("quantity must be a positive integer");
    const e = estimateItem(item, rules);
    const failure = applyBps(e.unitPayoutMinor, rules.failureAllowanceBps);
    const unitCost = e.unitPayoutMinor + failure + rules.packagingMinor / input.items.length;
    const targetNet = Math.round(unitCost / (1 - rules.targetMarginBps / 10000));
    const unitNetMinor = Math.max(rules.minUnitPriceNetMinor, targetNet);
    const lineNetMinor = applyBps(
      unitNetMinor * item.quantity,
      quantityMultiplier(item.quantity, rules),
    );
    items.push({ ...e, unitNetMinor, lineNetMinor });
    manufacturingNet += lineNetMinor;
    payout += e.unitPayoutMinor * item.quantity;
    if (item.quantity > rules.autoQuote.maxQuantity)
      reviewReasons.push("quantity_above_auto_limit");
    if (Math.max(...item.bboxMm) > rules.autoQuote.maxDimensionMm)
      reviewReasons.push("part_too_large");
  }
  // The per-order supplier setup payout is priced in at the target margin like any other cost.
  manufacturingNet += Math.round(rules.payout.setupMinor / (1 - rules.targetMarginBps / 10000));
  manufacturingNet = Math.max(manufacturingNet, rules.minOrderNetMinor);

  const lines: QuoteLine[] = [
    {
      kind: "manufacturing",
      labelKey: "quotes.lines.manufacturing",
      amountNetMinor: manufacturingNet,
    },
  ];
  const urgencyBps = rules.urgency[input.urgency];
  if (urgencyBps > 10000) {
    lines.push({
      kind: "urgency",
      labelKey: `quotes.lines.urgency_${input.urgency}`,
      amountNetMinor: applyBps(manufacturingNet, urgencyBps - 10000),
    });
  }
  if (input.designFeeNetMinor)
    lines.push({
      kind: "design_fee",
      labelKey: "quotes.lines.design_fee",
      amountNetMinor: input.designFeeNetMinor,
    });
  if (input.includeShipping)
    lines.push({
      kind: "shipping",
      labelKey: "quotes.lines.shipping",
      amountNetMinor: rules.shipping.priceNetMinor,
    });

  // Consumer prices are VAT-inclusive and rounded on the gross total; net and VAT are derived from it.
  const rawNet = lines.reduce((s, l) => s + l.amountNetMinor, 0);
  const totalMinor = roundToStep(
    applyBps(rawNet, 10000 + input.taxRateBps),
    rules.grossRoundingMinor,
  );
  const taxMinor = taxFromGross(totalMinor, input.taxRateBps);
  const subtotalNetMinor = totalMinor - taxMinor;
  // Absorb the rounding difference in the manufacturing line so the lines always sum to the net subtotal.
  lines[0]!.amountNetMinor += subtotalNetMinor - rawNet;

  const shippingCost = input.includeShipping ? rules.shipping.costMinor : 0;
  const costs =
    payout +
    applyBps(payout, rules.failureAllowanceBps) +
    rules.packagingMinor +
    shippingCost +
    applyBps(totalMinor, rules.paymentFeeBps);
  const expectedMarginMinor = subtotalNetMinor - costs;
  const marginBps =
    subtotalNetMinor > 0 ? Math.round((expectedMarginMinor / subtotalNetMinor) * 10000) : 0;
  if (marginBps < rules.autoQuote.minMarginBps) reviewReasons.push("margin_below_floor");
  if (totalMinor > rules.autoQuote.maxTotalMinor) reviewReasons.push("total_above_auto_limit");

  return {
    engineVersion: PRICING_ENGINE_VERSION,
    currency: rules.currency,
    items,
    lines,
    subtotalNetMinor,
    taxMinor,
    totalMinor,
    expectedPayoutMinor: payout,
    expectedMarginMinor,
    marginBps,
    leadDays: rules.urgencyLeadDays[input.urgency],
    reviewReasons: [...new Set(reviewReasons)],
  };
}

/** Stable hash of a quote's inputs and result, stored with the snapshot for tamper evidence. */
export function snapshotHash(value: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, stable((v as Record<string, unknown>)[k])]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}
