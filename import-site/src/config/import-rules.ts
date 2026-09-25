/**
 * Import-cost assumptions used by the calculator and the listing
 * estimates.
 *
 * IMPORTANT: these are illustrative planning assumptions, not tax
 * advice. Israeli purchase tax, customs duty, VAT, luxury-tax thresholds,
 * green-tax adjustments and customs valuation change over time and depend
 * on the specific vehicle. Keep this file owned by someone who checks it
 * against the Israel Tax Authority and a licensed customs broker, and
 * surface `rulesVersion` wherever a figure is shown.
 *
 * In the admin phase this object moves to the database so it can be
 * edited without a deploy — the calculator only depends on the shape.
 */
import type { CurrencyCode, FuelType, ShippingMethod } from "@/domain/types";

export interface ImportRules {
  rulesVersion: string;
  vatRate: number;
  /** Customs duty on CIF value for origins without a trade agreement. */
  customsDutyRate: number;
  /** Origins with a free-trade agreement covering passenger cars. */
  dutyFreeOrigins: string[];
  purchaseTaxRate: Record<FuelType, number>;
  /** Additional tax on the part of the value above the threshold. */
  luxuryTax: { thresholdILS: number; rate: number };
  insuranceRate: number;
  /** Port handling, unloading, storage — flat, ILS. */
  portFeesILS: number;
  /** Standards / roadworthiness testing and individual approval — flat, ILS. */
  complianceILS: number;
  registrationILS: number;
  handlingFeeILS: number;
  /** Shipping cost per region and method, in USD. */
  shippingUSD: Record<string, Partial<Record<ShippingMethod, number>>>;
  /** Default FX to ILS — always user-editable in the UI. */
  exchangeRates: Record<CurrencyCode, number>;
}

export const importRules: ImportRules = {
  rulesVersion: "2026-09 (illustrative)",
  vatRate: 0.18,
  customsDutyRate: 0.07,
  dutyFreeOrigins: ["DE", "IT", "FR", "GB", "US", "AE", "KR", "CA", "CH", "NL", "BE", "AT", "SE", "ES"],
  purchaseTaxRate: {
    petrol: 0.83,
    diesel: 0.83,
    hybrid: 0.83,
    "plug-in-hybrid": 0.55,
    electric: 0.45,
  },
  luxuryTax: { thresholdILS: 320_000, rate: 0.2 },
  insuranceRate: 0.015,
  portFeesILS: 4_200,
  complianceILS: 6_500,
  registrationILS: 3_800,
  handlingFeeILS: 9_500,
  shippingUSD: {
    EU: { roro: 1_800, container: 2_900, air: 16_000 },
    GB: { roro: 2_200, container: 3_300, air: 17_500 },
    US: { roro: 3_600, container: 4_900, air: 24_000 },
    AE: { roro: 1_900, container: 2_700, air: 9_500 },
    JP: { roro: 3_900, container: 5_200, air: 26_000 },
    KR: { roro: 3_700, container: 5_000, air: 25_000 },
    CA: { roro: 3_900, container: 5_200, air: 25_000 },
  },
  exchangeRates: {
    ILS: 1,
    EUR: 4.05,
    USD: 3.65,
    GBP: 4.85,
    AED: 0.99,
    JPY: 0.025,
    KRW: 0.0027,
    CHF: 4.3,
    CAD: 2.65,
  },
};

const EU = new Set(["DE", "IT", "FR", "NL", "BE", "AT", "SE", "ES", "CH"]);

export function shippingRegion(countryCode: string): string {
  if (EU.has(countryCode)) return "EU";
  return importRules.shippingUSD[countryCode] ? countryCode : "EU";
}
