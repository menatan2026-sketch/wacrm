"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { BodyType, Drivetrain, FuelType, SearchCriteria, SortKey, Transmission, Vehicle } from "@/domain/types";
import { markets } from "@/data/markets";
import { bodyTypeLabel, drivetrainLabel, formatILS, fuelLabel, transmissionLabel } from "@/lib/format";
import { criteriaToParams, searchVehicles } from "@/lib/search/filter";
import { colorFamilies, specLabels } from "@/lib/search/parse-query";
import { ArrowRight, Close, Filter } from "@/components/ui/icons";
import f from "@/components/ui/fields.module.css";
import { SmartQuery } from "./SmartQuery";
import { VehicleCard } from "./VehicleCard";
import s from "./SearchInterface.module.css";

const BUDGETS = [400_000, 600_000, 800_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000];
const MILEAGES = [1_000, 5_000, 10_000, 20_000, 50_000];
const SORTS: { id: SortKey; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "year-desc", label: "Newest first" },
  { id: "mileage-asc", label: "Lowest mileage" },
];
const SPEC_KEYS = ["full-spec", "carbon", "ceramic-brakes", "massage", "rear-entertainment", "lift", "weissach", "off-road"];

function chipText(k: keyof SearchCriteria, v: unknown): string {
  switch (k) {
    case "budgetMaxILS":
      return `≤ ${formatILS(v as number)}`;
    case "mileageMaxKm":
      return `≤ ${(v as number).toLocaleString("en-US")} km`;
    case "yearMin":
      return `${v}+`;
    case "yearMax":
      return `≤ ${v}`;
    case "fuel":
      return fuelLabel[v as FuelType];
    case "transmission":
      return transmissionLabel[v as Transmission];
    case "drivetrain":
      return (v as string).toUpperCase();
    case "bodyType":
      return bodyTypeLabel[v as BodyType];
    case "countryCode":
      return markets.find((m) => m.code === v)?.name ?? String(v);
    case "text":
      return `“${v}”`;
    default:
      return String(v);
  }
}

/**
 * Luxury search engine: natural-language query + precise filters, both
 * writing to one criteria object that's mirrored into the URL.
 */
export function SearchInterface({
  vehicles,
  initial,
  initialQuery = "",
  initialSort = "recommended",
  focusQuery = false,
}: {
  vehicles: Vehicle[];
  initial: Partial<SearchCriteria>;
  initialQuery?: string;
  initialSort?: SortKey;
  focusQuery?: boolean;
}) {
  const router = useRouter();
  const [criteria, setCriteria] = useState<Partial<SearchCriteria>>(initial);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const results = useMemo(() => searchVehicles(vehicles, criteria, sort), [vehicles, criteria, sort]);
  const makes = useMemo(() => [...new Set(vehicles.map((v) => v.make))].sort(), [vehicles]);

  // Mirror state into the URL (replace, no scroll) so searches are shareable.
  useEffect(() => {
    const p = criteriaToParams(criteria);
    if (sort !== "recommended") p.set("sort", sort);
    const qs = p.toString();
    router.replace(qs ? `/vehicles?${qs}` : "/vehicles", { scroll: false });
  }, [criteria, sort, router]);

  useEffect(() => {
    if (focusQuery) document.querySelector<HTMLTextAreaElement>("#vehicle-search textarea")?.focus({ preventScroll: true });
  }, [focusQuery]);

  const set = <K extends keyof SearchCriteria>(k: K, v: SearchCriteria[K] | undefined) =>
    setCriteria((c) => {
      const next = { ...c };
      if (v === undefined || v === ("" as unknown) || (Array.isArray(v) && v.length === 0)) delete next[k];
      else next[k] = v;
      return next;
    });

  const toggleSpec = (key: string) => {
    const cur = new Set(criteria.spec ?? []);
    if (cur.has(key)) cur.delete(key);
    else cur.add(key);
    set("spec", [...cur]);
  };

  type Chip = { k: keyof SearchCriteria; v: unknown; label: string };
  const chips = (Object.entries(criteria) as [keyof SearchCriteria, unknown][]).flatMap(([k, v]): Chip[] =>
    k === "spec" ? (v as string[]).map((sv) => ({ k, v: sv, label: specLabels[sv] ?? sv })) : [{ k, v, label: chipText(k, v) }],
  );

  const requestHref = `/request?${new URLSearchParams({
    ...(criteria.make ? { make: criteria.make } : {}),
    ...(criteria.model ? { model: criteria.model } : {}),
    ...(criteria.color ? { color: criteria.color } : {}),
    ...(criteria.budgetMaxILS ? { budget: String(criteria.budgetMaxILS) } : {}),
  })}`;

  return (
    <div className={s.root}>
      <div id="vehicle-search" className={s.query}>
        <SmartQuery
          initial={initialQuery}
          compact
          onSearch={(c) => {
            setCriteria(c);
            document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>

      <div className={s.bar} id="results">
        <button type="button" className={s.filterBtn} aria-expanded={filtersOpen} aria-controls="filters" onClick={() => setFiltersOpen((o) => !o)}>
          <Filter width={18} height={18} /> Filters {chips.length > 0 && <span className={s.badge}>{chips.length}</span>}
        </button>
        <p className={s.count} aria-live="polite">
          <span className="num">{results.length}</span> {results.length === 1 ? "vehicle" : "vehicles"}
        </p>
        <label className={s.sort}>
          <span className="sr-only">Sort</span>
          <select className={f.control} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {chips.length > 0 && (
        <ul className={s.chips}>
          {chips.map((c) => (
            <li key={`${c.k}-${String(c.v)}`}>
              <button
                type="button"
                onClick={() => (c.k === "spec" ? toggleSpec(String(c.v)) : set(c.k, undefined))}
                aria-label={`Remove ${c.label}`}
              >
                {c.label} <Close width={14} height={14} />
              </button>
            </li>
          ))}
          <li>
            <button type="button" className={s.clear} onClick={() => setCriteria({})}>
              Clear all
            </button>
          </li>
        </ul>
      )}

      <div id="filters" className={s.filters} data-open={filtersOpen}>
        <div className={s.filtersInner}>
          <div className={s.filterGrid}>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-make">
                Brand
              </label>
              <select id="flt-make" className={f.control} value={criteria.make ?? ""} onChange={(e) => set("make", e.target.value || undefined)}>
                <option value="">Any</option>
                {makes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-model">
                Model
              </label>
              <input id="flt-model" className={f.control} value={criteria.model ?? ""} placeholder="Any" onChange={(e) => set("model", e.target.value || undefined)} />
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-year">
                Year from
              </label>
              <select id="flt-year" className={f.control} value={criteria.yearMin ?? ""} onChange={(e) => set("yearMin", e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Any</option>
                {[2026, 2025, 2024, 2023, 2022, 2020, 2015].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-budget">
                Budget <span className={f.hint}>landed</span>
              </label>
              <select id="flt-budget" className={f.control} value={criteria.budgetMaxILS ?? ""} onChange={(e) => set("budgetMaxILS", e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Any</option>
                {BUDGETS.map((b) => (
                  <option key={b} value={b}>
                    Up to {formatILS(b)}
                  </option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-km">
                Mileage
              </label>
              <select id="flt-km" className={f.control} value={criteria.mileageMaxKm ?? ""} onChange={(e) => set("mileageMaxKm", e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Any</option>
                {MILEAGES.map((m) => (
                  <option key={m} value={m}>
                    Up to {m.toLocaleString("en-US")} km
                  </option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-engine">
                Engine
              </label>
              <input id="flt-engine" className={f.control} value={criteria.engine ?? ""} placeholder="V8, V12, electric…" onChange={(e) => set("engine", e.target.value || undefined)} />
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-fuel">
                Fuel
              </label>
              <select id="flt-fuel" className={f.control} value={criteria.fuel ?? ""} onChange={(e) => set("fuel", (e.target.value || undefined) as FuelType)}>
                <option value="">Any</option>
                {(Object.keys(fuelLabel) as FuelType[]).map((k) => (
                  <option key={k} value={k}>
                    {fuelLabel[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-trans">
                Transmission
              </label>
              <select id="flt-trans" className={f.control} value={criteria.transmission ?? ""} onChange={(e) => set("transmission", (e.target.value || undefined) as Transmission)}>
                <option value="">Any</option>
                {(Object.keys(transmissionLabel) as Transmission[]).map((k) => (
                  <option key={k} value={k}>
                    {transmissionLabel[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-drive">
                Drive
              </label>
              <select id="flt-drive" className={f.control} value={criteria.drivetrain ?? ""} onChange={(e) => set("drivetrain", (e.target.value || undefined) as Drivetrain)}>
                <option value="">Any</option>
                {(["awd", "4wd", "rwd"] as Drivetrain[]).map((k) => (
                  <option key={k} value={k}>
                    {drivetrainLabel[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-body">
                Body type
              </label>
              <select id="flt-body" className={f.control} value={criteria.bodyType ?? ""} onChange={(e) => set("bodyType", (e.target.value || undefined) as BodyType)}>
                <option value="">Any</option>
                {(Object.keys(bodyTypeLabel) as BodyType[]).map((k) => (
                  <option key={k} value={k}>
                    {bodyTypeLabel[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-country">
                Country
              </label>
              <select id="flt-country" className={f.control} value={criteria.countryCode ?? ""} onChange={(e) => set("countryCode", e.target.value || undefined)}>
                <option value="">Any</option>
                {markets.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.label} htmlFor="flt-color">
                Colour
              </label>
              <select id="flt-color" className={f.control} value={criteria.color ?? ""} onChange={(e) => set("color", e.target.value || undefined)}>
                <option value="">Any</option>
                {colorFamilies.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={f.field}>
            <span className={f.label}>Desired specification</span>
            <div className={f.segmented} role="group" aria-label="Desired specification">
              {SPEC_KEYS.map((k) => (
                <button key={k} type="button" aria-pressed={criteria.spec?.includes(k) ?? false} onClick={() => toggleSpec(k)}>
                  {specLabels[k]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {results.length > 0 ? (
        <div className={s.grid}>
          {results.map((r, i) => (
            <VehicleCard key={r.vehicle.id} vehicle={r.vehicle} index={i} priority={i < 3} />
          ))}
        </div>
      ) : (
        <div className={s.empty}>
          <p className="label">No exact match in current inventory</p>
          <h2 className="display-s">
            That doesn&apos;t mean it doesn&apos;t exist.
            <br />
            It means we haven&apos;t found it yet.
          </h2>
          <p className="body-l">Most of what we import is sourced to order. Send us this search and a specialist will start looking today.</p>
          <Link href={requestHref} className="btn btn-primary" data-cursor="open">
            Start the search <ArrowRight className="btn-arrow" />
          </Link>
        </div>
      )}

      <aside className={s.cta}>
        <div>
          <p className="label">Not seeing the exact spec?</p>
          <p className={s.ctaTitle}>Most of our imports are sourced to order.</p>
        </div>
        <Link href={requestHref} className="btn btn-ghost" data-cursor="open">
          We find it for you <ArrowRight className="btn-arrow" />
        </Link>
      </aside>
    </div>
  );
}
