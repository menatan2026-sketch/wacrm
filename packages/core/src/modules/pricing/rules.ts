import { z } from "zod";

const bps = z.number().int().min(0).max(100_000);
const minor = z.number().int().min(0);

/**
 * Versioned pricing rule set (stored as JSON in pricing_rule_sets.rules). Every coefficient the
 * engine uses lives here — nothing is hardcoded in code (MASTER_PLAN §13).
 */
export const pricingRulesSchema = z.object({
  currency: z.string().length(3),
  setupMinutes: z.number().min(0),
  extrusionRateGPerMin: z
    .object({ default: z.number().positive() })
    .catchall(z.number().positive()),
  profiles: z.record(
    z.string(),
    z.object({
      wallThicknessMm: z.number().positive(),
      infill: z.number().min(0).max(1),
      speedFactor: z.number().positive(),
      supportFactorMm: z.number().min(0),
    }),
  ),
  heightMinutesPerMm: z.number().min(0),
  payout: z.object({
    perGramMinor: z.object({ default: minor }).catchall(minor),
    perPrintMinuteMinor: minor,
    setupMinor: minor,
    minimumMinor: minor,
  }),
  packagingMinor: minor,
  paymentFeeBps: bps,
  failureAllowanceBps: bps,
  targetMarginBps: bps,
  minUnitPriceNetMinor: minor,
  minOrderNetMinor: minor,
  quantityBreaks: z.array(z.object({ minQty: z.number().int().min(1), multiplierBps: bps })).min(1),
  urgency: z.object({ standard: bps, fast: bps, urgent: bps }),
  urgencyLeadDays: z.object({
    standard: z.number().int().min(1),
    fast: z.number().int().min(1),
    urgent: z.number().int().min(1),
  }),
  shipping: z.object({ priceNetMinor: minor, costMinor: minor }),
  grossRoundingMinor: z.number().int().positive(),
  autoQuote: z.object({
    maxTotalMinor: minor,
    maxQuantity: z.number().int().positive(),
    minMarginBps: bps,
    maxDimensionMm: z.number().positive(),
  }),
  quoteValidityDays: z.number().int().positive(),
});
export type PricingRules = z.infer<typeof pricingRulesSchema>;

/** Placeholder launch values (KNOWN_ISSUES KI-003) — the business sets real ones in the admin. */
export const DEFAULT_FDM_RULES: PricingRules = {
  currency: "ILS",
  setupMinutes: 15,
  extrusionRateGPerMin: { default: 0.25, TPU_95A: 0.12, PA_CF: 0.18 },
  profiles: {
    draft: { wallThicknessMm: 0.8, infill: 0.15, speedFactor: 1.3, supportFactorMm: 1.5 },
    standard: { wallThicknessMm: 1.2, infill: 0.2, speedFactor: 1.0, supportFactorMm: 2.0 },
    fine: { wallThicknessMm: 1.6, infill: 0.25, speedFactor: 0.6, supportFactorMm: 2.0 },
  },
  heightMinutesPerMm: 0.4,
  payout: {
    perGramMinor: { default: 30, TPU_95A: 60, PA_CF: 120, ASA: 40, ABS: 35 },
    perPrintMinuteMinor: 8,
    setupMinor: 1500,
    minimumMinor: 3000,
  },
  packagingMinor: 600,
  paymentFeeBps: 150,
  failureAllowanceBps: 800,
  targetMarginBps: 4000,
  minUnitPriceNetMinor: 3500,
  minOrderNetMinor: 7000,
  quantityBreaks: [
    { minQty: 1, multiplierBps: 10000 },
    { minQty: 5, multiplierBps: 9200 },
    { minQty: 20, multiplierBps: 8500 },
  ],
  urgency: { standard: 10000, fast: 12500, urgent: 15000 },
  urgencyLeadDays: { standard: 7, fast: 4, urgent: 2 },
  shipping: { priceNetMinor: 2900, costMinor: 2200 },
  grossRoundingMinor: 100,
  autoQuote: { maxTotalMinor: 300_000, maxQuantity: 50, minMarginBps: 3000, maxDimensionMm: 300 },
  quoteValidityDays: 14,
};
