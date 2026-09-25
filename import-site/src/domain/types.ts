/**
 * Domain model for the public site.
 *
 * These types are the contract between the UI and whatever feeds it —
 * today the mock repositories in `src/data`, later Supabase/Postgres, an
 * inventory API, or the admin dashboard. UI components import from here,
 * never from a data source directly.
 */

export type CurrencyCode = "ILS" | "EUR" | "USD" | "GBP" | "AED" | "JPY" | "KRW" | "CHF" | "CAD";

export type FuelType = "petrol" | "diesel" | "hybrid" | "plug-in-hybrid" | "electric";
export type Transmission = "automatic" | "dual-clutch" | "manual";
export type Drivetrain = "rwd" | "awd" | "4wd" | "fwd";
export type BodyType = "suv" | "coupe" | "sedan" | "convertible" | "wagon" | "pickup" | "supercar";

/** How we know a data point. Drives the verified/estimate distinction in the UI. */
export type Provenance = "verified" | "reported" | "estimate";

export type AvailabilityStatus =
  | "available" // Located, seller confirmed, can be reserved
  | "reserved" // Deposit placed by a client
  | "in-transit" // Purchased, en route to Israel
  | "sourcing"; // Example spec we can source to order

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface VehicleImage {
  src: string;
  alt: string;
  /** Focal point for object-position, e.g. "50% 60%". */
  focus?: string;
}

export interface VerificationItem {
  key: VerificationKey;
  status: Provenance | "pending";
  note: string;
}

export type VerificationKey =
  | "history"
  | "mileage"
  | "ownership"
  | "accidents"
  | "service"
  | "mechanical"
  | "specification"
  | "documentation";

export interface Vehicle {
  id: string;
  slug: string;
  make: string;
  model: string;
  /** Trim/edition line shown under the model name. */
  variant?: string;
  year: number;
  bodyType: BodyType;
  status: AvailabilityStatus;

  /** Asking price in the origin market's currency. */
  price: Money;
  /** Pre-computed landed estimate (ILS). Recomputed server-side from import rules. */
  estimatedLandedPriceILS: number;

  mileageKm: number;
  engine: {
    label: string; // "4.0 V8 Biturbo"
    displacementCc: number | null; // null for EVs
    fuel: FuelType;
    powerHp: number;
    torqueNm: number;
    batteryKwh?: number;
  };
  acceleration0to100s: number;
  transmission: Transmission;
  drivetrain: Drivetrain;

  exterior: { name: string; hex: string };
  interior: string;

  location: { countryCode: string; city: string };

  /** Short editorial paragraph — "Why this car?". */
  highlight: string;
  /** Notable factory options. */
  options: string[];
  verification: VerificationItem[];

  images: VehicleImage[];
  /**
   * Optional id into the 3D model registry (`src/config/vehicle-models.ts`).
   * When present the detail page renders an interactive viewer instead of
   * the studio plate.
   */
  modelId?: string;

  /** Signals for search ranking; purely presentational today. */
  tags: string[];
  listedAt: string; // ISO date
}

export interface Market {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  hub: string; // Main port / logistics hub
  lat: number;
  lng: number;
  currency: CurrencyCode;
  typicalMarket: string;
  advantages: string[];
  exampleVehicles: string[];
  /** Typical door-to-door transit to Israel, in days. */
  transitDays: [number, number];
  /** Shipping methods commonly used from this market. */
  shipping: ShippingMethod[];
}

export type ShippingMethod = "roro" | "container" | "air";

export interface JourneyStep {
  index: number;
  key: string;
  title: string;
  summary: string;
  detail: string;
  /** Typical duration band, displayed as metadata. */
  duration: string;
}

export interface Service {
  key: string;
  title: string;
  summary: string;
  /** Journey step this service belongs to, used to tie services into the story. */
  journeyStep: string;
}

export interface Testimonial {
  id: string;
  /** Leave undefined until a client has approved being quoted. */
  quote?: string;
  customer: string;
  vehicle: string;
  origin: { countryCode: string; city: string; lat?: number; lng?: number };
  destination: string;
  deliveredOn?: string;
  image?: VehicleImage;
  /** True for layout samples that must be replaced by real, approved stories. */
  isSample: boolean;
}

/* ── Leads ─────────────────────────────────────────────────────────── */

export type LeadSource =
  | "find-my-car"
  | "vehicle-request"
  | "sourcing-request"
  | "calculator"
  | "specialist";

export interface LeadInput {
  source: LeadSource;
  name: string;
  phone: string;
  email?: string;
  preferredContact?: "whatsapp" | "phone" | "email";
  /** Vehicle the lead is about, when it came from a listing. */
  vehicleSlug?: string;
  criteria?: Partial<SearchCriteria>;
  mustHave?: string;
  niceToHave?: string;
  message?: string;
  consent: boolean;
  /** Honeypot — must stay empty. */
  company?: string;
}

/* ── Search ────────────────────────────────────────────────────────── */

export interface SearchCriteria {
  make: string;
  model: string;
  yearMin: number;
  yearMax: number;
  budgetMaxILS: number;
  mileageMaxKm: number;
  engine: string;
  fuel: FuelType;
  transmission: Transmission;
  drivetrain: Drivetrain;
  bodyType: BodyType;
  countryCode: string;
  color: string;
  spec: string[];
  text: string;
}

export type SortKey = "recommended" | "price-asc" | "price-desc" | "year-desc" | "mileage-asc";
