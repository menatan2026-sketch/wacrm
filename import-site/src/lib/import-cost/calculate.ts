import { importRules as defaultRules, shippingRegion, type ImportRules } from "@/config/import-rules";
import type { CurrencyCode, FuelType, ShippingMethod } from "@/domain/types";

export interface ImportCostInput {
  price: number;
  currency: CurrencyCode;
  /** Rate used to convert `currency` to ILS. */
  exchangeRate: number;
  countryCode: string;
  year: number;
  engineCc: number | null;
  fuel: FuelType;
  vehicleType: "passenger" | "suv" | "commercial";
  shipping: ShippingMethod;
}

export interface CostLine {
  key:
    | "vehicle"
    | "shipping"
    | "insurance"
    | "customs"
    | "purchaseTax"
    | "luxuryTax"
    | "vat"
    | "port"
    | "compliance"
    | "registration"
    | "handling";
  label: string;
  group: "vehicle" | "shipping" | "taxes" | "fees" | "registration";
  amountILS: number;
  /** Human-readable basis, e.g. "83% of CIF + duty". */
  basis: string;
}

export interface ImportCostResult {
  lines: CostLine[];
  groups: Record<CostLine["group"], number>;
  totalILS: number;
  /** ± band applied to the total to communicate uncertainty. */
  range: [number, number];
  notes: string[];
  rulesVersion: string;
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const round = (n: number) => Math.round(n / 10) * 10;

/**
 * Israeli landed-cost cascade (simplified):
 *   CIF        = vehicle + freight + insurance
 *   duty       = CIF × duty rate            (0 for FTA origins)
 *   purchase   = (CIF + duty) × purchase-tax rate
 *   luxury     = (value above threshold) × luxury rate
 *   VAT        = (CIF + duty + purchase + luxury + port) × VAT
 *   + compliance, registration and our handling fee
 */
export function calculateImportCost(
  input: ImportCostInput,
  rules: ImportRules = defaultRules,
): ImportCostResult {
  const vehicleILS = Math.max(0, input.price) * input.exchangeRate;
  const region = shippingRegion(input.countryCode);
  const freightUSD =
    rules.shippingUSD[region]?.[input.shipping] ?? rules.shippingUSD.EU.container ?? 0;
  const suvSurcharge = input.vehicleType === "passenger" ? 1 : 1.18;
  const shippingILS = freightUSD * suvSurcharge * rules.exchangeRates.USD;
  const insuranceILS = (vehicleILS + shippingILS) * rules.insuranceRate;
  const cif = vehicleILS + shippingILS + insuranceILS;

  const dutyFree = rules.dutyFreeOrigins.includes(input.countryCode);
  const dutyRate = dutyFree ? 0 : rules.customsDutyRate;
  const customsILS = cif * dutyRate;

  const ptRate = rules.purchaseTaxRate[input.fuel];
  const purchaseTaxILS = (cif + customsILS) * ptRate;

  const taxableBeforeVat = cif + customsILS + purchaseTaxILS;
  const luxuryBase = Math.max(0, taxableBeforeVat - rules.luxuryTax.thresholdILS);
  const luxuryTaxILS = luxuryBase * rules.luxuryTax.rate;

  const vatILS = (taxableBeforeVat + luxuryTaxILS + rules.portFeesILS) * rules.vatRate;

  const lines: CostLine[] = [
    {
      key: "vehicle",
      label: "Vehicle price",
      group: "vehicle",
      amountILS: vehicleILS,
      basis: `${input.price.toLocaleString("en-US")} ${input.currency} × ${input.exchangeRate}`,
    },
    {
      key: "shipping",
      label: "Transport",
      group: "shipping",
      amountILS: shippingILS,
      basis: `${input.shipping.toUpperCase()} from ${region}`,
    },
    {
      key: "insurance",
      label: "Transit insurance",
      group: "shipping",
      amountILS: insuranceILS,
      basis: `${pct(rules.insuranceRate)} of vehicle + freight`,
    },
    {
      key: "customs",
      label: "Customs duty",
      group: "taxes",
      amountILS: customsILS,
      basis: dutyFree ? "Trade-agreement origin — 0%" : `${pct(dutyRate)} of CIF`,
    },
    {
      key: "purchaseTax",
      label: "Purchase tax",
      group: "taxes",
      amountILS: purchaseTaxILS,
      basis: `${pct(ptRate)} of CIF + duty`,
    },
    {
      key: "luxuryTax",
      label: "Luxury tax",
      group: "taxes",
      amountILS: luxuryTaxILS,
      basis:
        luxuryTaxILS > 0
          ? `${pct(rules.luxuryTax.rate)} above ₪${rules.luxuryTax.thresholdILS.toLocaleString("en-US")}`
          : "Below threshold",
    },
    {
      key: "vat",
      label: "VAT",
      group: "taxes",
      amountILS: vatILS,
      basis: `${pct(rules.vatRate)} of taxable value`,
    },
    {
      key: "port",
      label: "Port & unloading",
      group: "fees",
      amountILS: rules.portFeesILS,
      basis: "Flat estimate",
    },
    {
      key: "compliance",
      label: "Testing & approval",
      group: "fees",
      amountILS: rules.complianceILS,
      basis: "Standards testing, individual approval",
    },
    {
      key: "handling",
      label: "Portolan handling",
      group: "fees",
      amountILS: rules.handlingFeeILS,
      basis: "Sourcing, paperwork, coordination",
    },
    {
      key: "registration",
      label: "Registration & licensing",
      group: "registration",
      amountILS: rules.registrationILS,
      basis: "Plates, first licence, road test",
    },
  ].map((l) => ({ ...l, amountILS: round(l.amountILS) })) as CostLine[];

  const groups = lines.reduce(
    (acc, l) => {
      acc[l.group] += l.amountILS;
      return acc;
    },
    { vehicle: 0, shipping: 0, taxes: 0, fees: 0, registration: 0 } as Record<CostLine["group"], number>,
  );
  const totalILS = lines.reduce((s, l) => s + l.amountILS, 0);

  const notes: string[] = [];
  const age = new Date().getFullYear() - input.year;
  if (age > 1) {
    notes.push(
      "Used vehicles are valued by customs, not only by the invoice — the assessed value can differ from the purchase price.",
    );
  }
  if (age > 5) {
    notes.push("Older vehicles may fall under different personal-import eligibility rules. We check eligibility before any purchase.");
  }
  if (input.fuel === "electric" || input.fuel === "plug-in-hybrid") {
    notes.push("Electrified vehicles carry a reduced purchase-tax rate that is scheduled to change — confirm the rate at the time of release.");
  }
  if (input.engineCc && input.fuel !== "electric") {
    notes.push(
      "Engine size doesn't change the purchase-tax rate in this model; it can affect green-rating adjustments and annual licensing.",
    );
  }

  return {
    lines,
    groups,
    totalILS,
    range: [round(totalILS * 0.95), round(totalILS * 1.06)],
    notes,
    rulesVersion: rules.rulesVersion,
  };
}
