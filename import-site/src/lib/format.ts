import type { CurrencyCode, Drivetrain, FuelType, Transmission, BodyType, AvailabilityStatus } from "@/domain/types";

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  ILS: "₪",
  EUR: "€",
  USD: "$",
  GBP: "£",
  AED: "AED ",
  JPY: "¥",
  KRW: "₩",
  CHF: "CHF ",
  CAD: "C$",
};

export function formatMoney(amount: number, currency: CurrencyCode = "ILS") {
  return `${CURRENCY_SYMBOL[currency]}${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatILS(amount: number) {
  return formatMoney(amount, "ILS");
}

export function formatCompactILS(amount: number) {
  if (amount >= 1_000_000) return `₪${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 2)}M`;
  if (amount >= 1_000) return `₪${Math.round(amount / 1_000)}K`;
  return formatILS(amount);
}

export function formatKm(km: number) {
  return `${km.toLocaleString("en-US")} KM`;
}

export const fuelLabel: Record<FuelType, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  hybrid: "Hybrid",
  "plug-in-hybrid": "Plug-in hybrid",
  electric: "Electric",
};

export const transmissionLabel: Record<Transmission, string> = {
  automatic: "Automatic",
  "dual-clutch": "Dual-clutch",
  manual: "Manual",
};

export const drivetrainLabel: Record<Drivetrain, string> = {
  rwd: "Rear-wheel drive",
  awd: "All-wheel drive",
  "4wd": "Four-wheel drive",
  fwd: "Front-wheel drive",
};

export const bodyTypeLabel: Record<BodyType, string> = {
  suv: "SUV",
  coupe: "Coupé",
  sedan: "Sedan",
  convertible: "Convertible",
  wagon: "Wagon",
  pickup: "Pickup",
  supercar: "Supercar",
};

export const statusLabel: Record<AvailabilityStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  "in-transit": "In transit",
  sourcing: "Source to order",
};

export function pad2(n: number) {
  return n.toString().padStart(2, "0");
}
