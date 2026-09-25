"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { importRules } from "@/config/import-rules";
import type { CurrencyCode, FuelType, ShippingMethod } from "@/domain/types";
import { markets } from "@/data/markets";
import { calculateImportCost, type CostLine, type ImportCostInput } from "@/lib/import-cost/calculate";
import { formatILS, fuelLabel } from "@/lib/format";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ArrowRight, Plus } from "@/components/ui/icons";
import f from "@/components/ui/fields.module.css";
import s from "./ImportCalculator.module.css";

const GROUPS: { key: CostLine["group"]; label: string }[] = [
  { key: "vehicle", label: "Vehicle" },
  { key: "shipping", label: "Shipping" },
  { key: "taxes", label: "Taxes" },
  { key: "fees", label: "Fees" },
  { key: "registration", label: "Registration" },
];

const FUELS: FuelType[] = ["petrol", "diesel", "hybrid", "plug-in-hybrid", "electric"];
const SHIPPING: { id: ShippingMethod; label: string }[] = [
  { id: "roro", label: "RoRo" },
  { id: "container", label: "Container" },
  { id: "air", label: "Air freight" },
];
const TYPES: { id: ImportCostInput["vehicleType"]; label: string }[] = [
  { id: "passenger", label: "Passenger car" },
  { id: "suv", label: "SUV / 4×4" },
  { id: "commercial", label: "Pickup / LCV" },
];

const CURRENCY_SYMBOL: Partial<Record<CurrencyCode, string>> = { EUR: "€", USD: "$", GBP: "£", AED: "AED", JPY: "¥", KRW: "₩" };

export interface CalculatorDefaults {
  price?: number;
  countryCode?: string;
  year?: number;
  engineCc?: number | null;
  fuel?: FuelType;
}

/**
 * Personal import calculator. Every figure is produced by
 * `calculateImportCost` from `config/import-rules.ts` — the same engine
 * that prices the listings — and is labelled as an estimate throughout.
 */
export function ImportCalculator({ defaults = {}, variant = "full" }: { defaults?: CalculatorDefaults; variant?: "full" | "compact" }) {
  const uid = useId();
  const [countryCode, setCountry] = useState(defaults.countryCode ?? "DE");
  const market = markets.find((m) => m.code === countryCode) ?? markets[0];
  const [price, setPrice] = useState(defaults.price ?? 145000);
  const [year, setYear] = useState(defaults.year ?? new Date().getFullYear());
  const [engineCc, setEngine] = useState<number | null>(defaults.engineCc ?? 3982);
  const [fuel, setFuel] = useState<FuelType>(defaults.fuel ?? "petrol");
  const [vehicleType, setType] = useState<ImportCostInput["vehicleType"]>("suv");
  const [shipping, setShipping] = useState<ShippingMethod>("roro");
  const [fxOverride, setFx] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(variant === "full");

  const currency = market.currency;
  const rate = fxOverride[currency] ?? importRules.exchangeRates[currency];
  const available = market.shipping;
  const method = available.includes(shipping) ? shipping : available[0];

  const result = calculateImportCost({
    price: Number.isFinite(price) ? price : 0,
    currency,
    exchangeRate: rate,
    countryCode,
    year,
    engineCc: fuel === "electric" ? null : engineCc,
    fuel,
    vehicleType,
    shipping: method,
  });

  const total = result.totalILS;
  const years = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() + 1 - i);

  const requestHref = `/request?${new URLSearchParams({
    source: "calculator",
    country: countryCode,
    budget: String(Math.round(result.range[1] / 1000) * 1000),
  })}`;

  return (
    <div className={s.calc} data-variant={variant}>
      <form className={s.inputs} onSubmit={(e) => e.preventDefault()} aria-label="Import cost inputs">
        <div className={`${f.field} ${f.withPrefix}`}>
          <label className={f.label} htmlFor={`${uid}-price`}>
            Vehicle purchase price <span className={f.hint}>{currency}</span>
          </label>
          <span className={f.prefix}>{CURRENCY_SYMBOL[currency] ?? currency}</span>
          <input
            id={`${uid}-price`}
            className={`${f.control} num`}
            inputMode="numeric"
            value={price ? price.toLocaleString("en-US") : ""}
            onChange={(e) => setPrice(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
          />
        </div>

        <div className={s.row2}>
          <div className={f.field}>
            <label className={f.label} htmlFor={`${uid}-country`}>
              Country
            </label>
            <select id={`${uid}-country`} className={f.control} value={countryCode} onChange={(e) => setCountry(e.target.value)}>
              {markets.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor={`${uid}-year`}>
              Year
            </label>
            <select id={`${uid}-year`} className={f.control} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={f.field}>
          <span className={f.label}>Fuel type</span>
          <div className={f.segmented} role="group" aria-label="Fuel type">
            {FUELS.map((fu) => (
              <button key={fu} type="button" aria-pressed={fuel === fu} onClick={() => setFuel(fu)}>
                {fuelLabel[fu]}
              </button>
            ))}
          </div>
        </div>

        {variant === "full" || open ? (
          <>
            <div className={s.row2}>
              <div className={f.field}>
                <label className={f.label} htmlFor={`${uid}-engine`}>
                  Engine size <span className={f.hint}>cc</span>
                </label>
                <input
                  id={`${uid}-engine`}
                  className={`${f.control} num`}
                  inputMode="numeric"
                  disabled={fuel === "electric"}
                  value={fuel === "electric" ? "—" : engineCc ? engineCc.toLocaleString("en-US") : ""}
                  onChange={(e) => setEngine(Number(e.target.value.replace(/[^\d]/g, "")) || null)}
                />
              </div>
              <div className={f.field}>
                <label className={f.label} htmlFor={`${uid}-fx`}>
                  Exchange rate <span className={f.hint}>{currency} → ₪</span>
                </label>
                <input
                  id={`${uid}-fx`}
                  className={`${f.control} num`}
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setFx((o) => ({ ...o, [currency]: Number.isFinite(v) ? v : 0 }));
                  }}
                />
              </div>
            </div>

            <div className={f.field}>
              <span className={f.label}>Vehicle type</span>
              <div className={f.segmented} role="group" aria-label="Vehicle type">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" aria-pressed={vehicleType === t.id} onClick={() => setType(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={f.field}>
              <span className={f.label}>
                Shipping method <span className={f.hint}>from {market.hub}</span>
              </span>
              <div className={f.segmented} role="group" aria-label="Shipping method">
                {SHIPPING.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={method === m.id}
                    disabled={!available.includes(m.id)}
                    onClick={() => setShipping(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <button type="button" className={s.more} onClick={() => setOpen(true)}>
            <Plus width={16} height={16} /> Engine, exchange rate, vehicle type, shipping
          </button>
        )}
      </form>

      <div className={s.output} aria-live="polite">
        <p className="label">Estimated landed cost in Israel</p>

        <div className={s.equation}>
          {GROUPS.map((g, i) => (
            <div key={g.key} className={s.term}>
              <span className={s.op}>{i === 0 ? "" : "+"}</span>
              <span className={s.termLabel}>{g.label}</span>
              <AnimatedNumber className={s.termValue} value={result.groups[g.key]} format={(n) => formatILS(n)} />
            </div>
          ))}
          <div className={s.equals} />
          <div className={s.totalRow}>
            <span className={s.termLabel}>Estimated total</span>
            <AnimatedNumber className={s.total} value={total} format={(n) => formatILS(n)} />
          </div>
          <p className={s.range}>
            Likely range <span className="num">{formatILS(result.range[0])}</span> – <span className="num">{formatILS(result.range[1])}</span>
          </p>
        </div>

        <div className={s.bar} role="img" aria-label="Cost composition">
          {GROUPS.map((g) => (
            <span
              key={g.key}
              className={s.seg}
              data-group={g.key}
              style={{ flexGrow: Math.max(0.001, result.groups[g.key] / total) }}
              title={`${g.label}: ${formatILS(result.groups[g.key])}`}
            />
          ))}
        </div>
        <ul className={s.legend}>
          {GROUPS.map((g) => (
            <li key={g.key} data-group={g.key}>
              {g.label} <span className="num">{Math.round((result.groups[g.key] / total) * 100)}%</span>
            </li>
          ))}
        </ul>

        {variant === "full" && (
          <table className={s.lines}>
            <caption className="sr-only">Line-by-line estimate</caption>
            <tbody>
              {result.lines.map((l) => (
                <tr key={l.key}>
                  <th scope="row">
                    {l.label}
                    <span>{l.basis}</span>
                  </th>
                  <td className="num">{formatILS(l.amountILS)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {result.notes.length > 0 && variant === "full" && (
          <ul className={s.notes}>
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        <p className={s.disclaimer}>
          This is an estimate, not a quote. Final costs depend on customs valuation, applicable taxes and regulations at the time of
          import, exchange rates and the specific vehicle. Assumptions: rules {result.rulesVersion}.
        </p>

        <div className={s.ctas}>
          <Link href={requestHref} className="btn btn-primary" data-cursor="open">
            Talk to an import specialist <ArrowRight className="btn-arrow" />
          </Link>
          {variant === "compact" && (
            <Link href="/import" className="link">
              Full calculator
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
