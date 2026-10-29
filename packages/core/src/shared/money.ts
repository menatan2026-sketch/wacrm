/** Money is integer minor units (agorot for ILS) plus currency. Never floats. */
export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export const money = (amountMinor: number, currency = "ILS"): Money => {
  if (!Number.isSafeInteger(amountMinor))
    throw new Error(`money must be an integer, got ${amountMinor}`);
  return { amountMinor, currency };
};

/** Round half away from zero to the nearest multiple of `step` minor units. */
export function roundToStep(value: number, step = 1): number {
  if (step <= 0) throw new Error("step must be positive");
  const scaled = value / step;
  return Math.sign(scaled) * Math.round(Math.abs(scaled)) * step;
}

/** Multiply by basis points (10000 = 100%), rounding to whole minor units. */
export function applyBps(amountMinor: number, bps: number): number {
  return roundToStep((amountMinor * bps) / 10000);
}

/** VAT contained in a VAT-inclusive gross amount. */
export function taxFromGross(grossMinor: number, rateBps: number): number {
  return roundToStep((grossMinor * rateBps) / (10000 + rateBps));
}
