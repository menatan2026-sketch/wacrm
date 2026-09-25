/**
 * Data access for the public site.
 *
 * UI code talks to these interfaces only. Today they're backed by mock
 * data; swapping in Supabase/Postgres or an inventory API means writing
 * another implementation and changing `repositories` below — nothing in
 * the components changes. Keep them async even when the mock is sync so
 * the call sites are already shaped for network I/O.
 *
 * The admin dashboard (a separate app) owns writes; the public site only
 * reads, plus submits leads through /api/leads.
 */
import { importRules } from "@/config/import-rules";
import type { Market, SearchCriteria, Service, SortKey, Testimonial, Vehicle, JourneyStep } from "@/domain/types";
import { calculateImportCost } from "@/lib/import-cost/calculate";
import { searchVehicles, type SearchResult } from "@/lib/search/filter";
import { vehicleRecords, type VehicleRecord } from "@/data/vehicles";
import { markets } from "@/data/markets";
import { journey, services, testimonials } from "@/data/content";

export interface VehicleRepository {
  list(): Promise<Vehicle[]>;
  search(criteria: Partial<SearchCriteria>, sort?: SortKey): Promise<SearchResult[]>;
  getBySlug(slug: string): Promise<Vehicle | null>;
  featured(limit?: number): Promise<Vehicle[]>;
  related(vehicle: Vehicle, limit?: number): Promise<Vehicle[]>;
}

export interface ContentRepository {
  markets(): Promise<Market[]>;
  journey(): Promise<JourneyStep[]>;
  services(): Promise<Service[]>;
  testimonials(): Promise<Testimonial[]>;
}

/** Landed estimate for a listing, from the same engine as the calculator. */
export function estimateLanded(record: VehicleRecord): number {
  const result = calculateImportCost({
    price: record.price.amount,
    currency: record.price.currency,
    exchangeRate: importRules.exchangeRates[record.price.currency],
    countryCode: record.location.countryCode,
    year: record.year,
    engineCc: record.engine.displacementCc,
    fuel: record.engine.fuel,
    vehicleType: record.bodyType === "suv" || record.bodyType === "pickup" ? "suv" : "passenger",
    shipping: record.location.countryCode === "JP" ? "container" : "roro",
  });
  return Math.round(result.totalILS / 1000) * 1000;
}

class MockVehicleRepository implements VehicleRepository {
  private readonly vehicles: Vehicle[] = vehicleRecords.map((r) => ({
    ...r,
    estimatedLandedPriceILS: estimateLanded(r),
  }));

  async list() {
    return this.vehicles;
  }
  async search(criteria: Partial<SearchCriteria>, sort: SortKey = "recommended") {
    return searchVehicles(this.vehicles, criteria, sort);
  }
  async getBySlug(slug: string) {
    return this.vehicles.find((v) => v.slug === slug) ?? null;
  }
  async featured(limit = 6) {
    const order = ["2025-mercedes-amg-g63", "2024-porsche-911-gt3-rs", "2025-range-rover-sv", "2025-porsche-taycan-turbo-gt", "2024-ferrari-296-gtb", "2025-lucid-air-sapphire"];
    return order
      .map((s) => this.vehicles.find((v) => v.slug === s))
      .filter((v): v is Vehicle => Boolean(v))
      .slice(0, limit);
  }
  async related(vehicle: Vehicle, limit = 3) {
    return this.vehicles
      .filter((v) => v.id !== vehicle.id)
      .map((v) => ({
        v,
        s:
          (v.bodyType === vehicle.bodyType ? 2 : 0) +
          (v.make === vehicle.make ? 1.5 : 0) +
          (v.location.countryCode === vehicle.location.countryCode ? 0.5 : 0) -
          Math.abs(v.estimatedLandedPriceILS - vehicle.estimatedLandedPriceILS) / 2_000_000,
      }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.v);
  }
}

class MockContentRepository implements ContentRepository {
  async markets() {
    return markets;
  }
  async journey() {
    return journey;
  }
  async services() {
    return services;
  }
  async testimonials() {
    return testimonials;
  }
}

export const repositories = {
  vehicles: new MockVehicleRepository() as VehicleRepository,
  content: new MockContentRepository() as ContentRepository,
};
