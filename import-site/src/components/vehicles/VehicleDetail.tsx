import Link from "next/link";
import { importRules } from "@/config/import-rules";
import { verificationLabels } from "@/data/content";
import { marketName } from "@/data/markets";
import type { Vehicle } from "@/domain/types";
import { calculateImportCost } from "@/lib/import-cost/calculate";
import { drivetrainLabel, formatILS, formatKm, formatMoney, fuelLabel, statusLabel, transmissionLabel } from "@/lib/format";
import { ContactForm } from "@/components/forms/ContactForm";
import { ArrowRight } from "@/components/ui/icons";
import { Reveal, RevealText } from "@/components/ui/RevealText";
import { DetailViewer } from "./DetailViewer";
import { StickyRequestBar } from "./StickyRequestBar";
import { VehicleCard } from "./VehicleCard";
import { VehicleMedia } from "./VehicleMedia";
import s from "./VehicleDetail.module.css";

const STATUS_TEXT = { verified: "Verified", reported: "Reported", estimate: "Estimate", pending: "Pending" } as const;

/**
 * Immersive vehicle page: cinematic hero (3D when a model exists),
 * progressive specification, "why this car", verification file and a
 * transparent import estimate.
 */
export function VehicleDetail({ vehicle, related }: { vehicle: Vehicle; related: Vehicle[] }) {
  const v = vehicle;
  const estimate = calculateImportCost({
    price: v.price.amount,
    currency: v.price.currency,
    exchangeRate: importRules.exchangeRates[v.price.currency],
    countryCode: v.location.countryCode,
    year: v.year,
    engineCc: v.engine.displacementCc,
    fuel: v.engine.fuel,
    vehicleType: v.bodyType === "suv" || v.bodyType === "pickup" ? "suv" : "passenger",
    shipping: v.location.countryCode === "JP" ? "container" : "roro",
  });
  const line = (k: string) => estimate.lines.find((l) => l.key === k)?.amountILS ?? 0;
  const breakdown = [
    { label: "Vehicle price", value: line("vehicle"), note: formatMoney(v.price.amount, v.price.currency) },
    { label: "Transport", value: line("shipping"), note: v.location.countryCode === "JP" ? "Container" : "RoRo" },
    { label: "Insurance", value: line("insurance"), note: "Transit cover" },
    { label: "Taxes", value: line("purchaseTax") + line("luxuryTax") + line("vat"), note: "Purchase tax, luxury tax, VAT" },
    { label: "Customs", value: line("customs"), note: line("customs") === 0 ? "Trade-agreement origin" : "Duty on CIF" },
    { label: "Registration", value: line("registration"), note: "Plates, licence, road test" },
    { label: "Handling", value: line("handling"), note: "Sourcing & coordination" },
    { label: "Other costs", value: line("port") + line("compliance"), note: "Port, testing & approval" },
  ];

  const specs: [string, string][] = [
    ["Engine", v.engine.label],
    ["Power", `${v.engine.powerHp.toLocaleString("en-US")} hp`],
    ["Torque", `${v.engine.torqueNm.toLocaleString("en-US")} Nm`],
    ["0–100 km/h", `${v.acceleration0to100s.toFixed(1)} s`],
    ["Mileage", formatKm(v.mileageKm)],
    ["Transmission", transmissionLabel[v.transmission]],
    ["Drivetrain", drivetrainLabel[v.drivetrain]],
    ["Fuel", fuelLabel[v.engine.fuel] + (v.engine.batteryKwh ? ` · ${v.engine.batteryKwh} kWh` : "")],
    ["Exterior", v.exterior.name],
    ["Interior", v.interior],
    ["Country", `${marketName(v.location.countryCode)} · ${v.location.city}`],
  ];

  const calcHref = `/import`;
  const title = `${v.year} ${v.make} ${v.model}`;

  return (
    <article className={s.page}>
      <header className={s.hero}>
        <div className={s.media}>
          {v.modelId ? (
            <DetailViewer modelId={v.modelId} />
          ) : (
            <>
              <VehicleMedia vehicle={v} variant="hero" className={s.plate} priority sizes="100vw" />
              {v.images.length === 0 && <p className={s.caption}>Studio illustration · verified photography supplied per vehicle</p>}
            </>
          )}
        </div>
        <div className={`container ${s.heroText}`}>
          <p className={s.meta}>
            <span className={s.status} data-status={v.status}>
              {statusLabel[v.status]}
            </span>
            <span>{marketName(v.location.countryCode)}</span>
            <span>{v.location.city}</span>
          </p>
          <p className={s.make}>{v.make}</p>
          <RevealText as="h1" className={`display-l ${s.model}`} lines={[v.model]} threshold={0} />
          <p className={s.year}>
            {v.year}
            {v.variant ? ` · ${v.variant}` : ""}
          </p>
        </div>
      </header>

      <section className={`container ${s.figures}`} aria-label="Key figures">
        <Reveal className={s.priceBlock}>
          <p className="label">Estimated landed price in Israel</p>
          <p className={`${s.price} num`}>{formatILS(estimate.totalILS)}</p>
          <p className={s.priceNote}>
            Asking {formatMoney(v.price.amount, v.price.currency)} in {marketName(v.location.countryCode)} · estimate, not an offer
          </p>
          <Link href="#request" className="btn btn-primary" data-cursor="open">
            Request this vehicle <ArrowRight className="btn-arrow" />
          </Link>
        </Reveal>
        <dl className={s.specs}>
          {specs.map(([k, val], i) => (
            <Reveal key={k} className={`fade-up ${s.spec}`} style={{ "--d": `${i * 60}ms` } as React.CSSProperties} threshold={0.1}>
              <dt className="label">{k}</dt>
              <dd>{val}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      <section className={`container ${s.why}`} aria-labelledby="why-title">
        <div>
          <p className={s.index}>Why this car?</p>
          <RevealText id="why-title" className="display-m" lines={["The", "configuration."]} />
        </div>
        <div className={s.whyBody}>
          <Reveal as="p" className={`fade-up ${s.highlight}`}>
            {v.highlight}
          </Reveal>
          <ul className={s.options}>
            {v.options.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`container ${s.verify}`} aria-labelledby="file-title">
        <div className={s.verifyHead}>
          <p className={s.index}>Verification file</p>
          <h2 id="file-title" className="display-s">
            What we know,
            <br />
            and how we know it.
          </h2>
        </div>
        <ul className={s.file}>
          {v.verification.map((item) => (
            <li key={item.key} data-status={item.status}>
              <span className={s.fileTitle}>{verificationLabels[item.key].title}</span>
              <span className={s.fileNote}>{item.note}</span>
              <span className={s.fileStatus}>{STATUS_TEXT[item.status]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={`container ${s.estimate}`} aria-labelledby="estimate-title">
        <div className={s.estimateHead}>
          <p className={s.index}>Import estimate</p>
          <h2 id="estimate-title" className="display-s">
            From {marketName(v.location.countryCode)}
            <br />
            to your driveway.
          </h2>
          <p className={s.estimateNote}>
            Calculated from the listing price with our current planning assumptions ({estimate.rulesVersion}). Final costs depend on
            customs valuation, taxes and regulations at the time of import.
          </p>
          <Link href={calcHref} className="link">
            Calculate import cost
          </Link>
        </div>
        <div className={s.table}>
          {breakdown.map((b) => (
            <div key={b.label} className={s.row}>
              <span>{b.label}</span>
              <span className={s.rowNote}>{b.note}</span>
              <span className="num">{formatILS(b.value)}</span>
            </div>
          ))}
          <div className={s.total}>
            <span className="label">Estimated final price in Israel</span>
            <span className={`num ${s.totalValue}`}>{formatILS(estimate.totalILS)}</span>
            <span className={s.range}>
              Likely range {formatILS(estimate.range[0])} – {formatILS(estimate.range[1])}
            </span>
          </div>
        </div>
      </section>

      <section id="request" className={`container ${s.request}`} aria-labelledby="request-title">
        <div className={s.requestHead}>
          <p className={s.index}>Request this vehicle</p>
          <h2 id="request-title" className="display-m">
            Make it
            <br />
            yours.
          </h2>
          <p className="body-l">A specialist confirms availability, the latest landed estimate and next steps — usually within a business day.</p>
        </div>
        <ContactForm source="vehicle-request" vehicleSlug={v.slug} vehicleLabel={title} mode="vehicle" />
      </section>

      {related.length > 0 && (
        <section className={`container ${s.related}`} aria-labelledby="related-title">
          <div className={s.relatedHead}>
            <h2 id="related-title" className="label label-strong">
              You may also consider
            </h2>
            <Link href="/vehicles" className="link">
              All vehicles
            </Link>
          </div>
          <div className={s.relatedGrid}>
            {related.map((r, i) => (
              <VehicleCard key={r.id} vehicle={r} index={i} />
            ))}
          </div>
        </section>
      )}

      <StickyRequestBar title={title} price={formatILS(estimate.totalILS)} />
    </article>
  );
}
