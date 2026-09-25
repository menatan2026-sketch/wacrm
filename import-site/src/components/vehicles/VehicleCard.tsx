"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Vehicle } from "@/domain/types";
import { marketName } from "@/data/markets";
import { formatILS, formatKm, statusLabel } from "@/lib/format";
import { ArrowRight } from "@/components/ui/icons";
import { useReveal } from "@/components/ui/RevealText";
import { VehicleMedia } from "./VehicleMedia";
import s from "./VehicleCard.module.css";

/**
 * Editorial inventory card. Large image, restrained metadata, one CTA.
 * Tilts a few degrees toward the pointer on desktop.
 */
export function VehicleCard({ vehicle, index = 0, priority = false }: { vehicle: Vehicle; index?: number; priority?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  useReveal(ref, 0.15);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !tilt.current) return;
    const r = tilt.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tilt.current.style.setProperty("--rx", `${(-y * 4).toFixed(2)}deg`);
    tilt.current.style.setProperty("--ry", `${(x * 5).toFixed(2)}deg`);
    tilt.current.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    tilt.current?.style.setProperty("--rx", "0deg");
    tilt.current?.style.setProperty("--ry", "0deg");
  };

  return (
    <article
      ref={ref}
      className={s.card}
      data-revealed="false"
      style={{ "--d": `${(index % 3) * 90}ms` } as React.CSSProperties}
    >
      <Link
        href={`/vehicles/${vehicle.slug}`}
        className={s.link}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        data-cursor="view"
        aria-label={`${vehicle.year} ${vehicle.make} ${vehicle.model} — view vehicle`}
      >
        <div ref={tilt} className={s.tilt}>
          <div className={s.media}>
            <VehicleMedia vehicle={vehicle} className={s.img} priority={priority} />
            <div className={s.sheen} />
            <span className={s.status} data-status={vehicle.status}>
              {statusLabel[vehicle.status]}
            </span>
            <span className={s.origin}>{vehicle.location.countryCode}</span>
          </div>

          <div className={s.body}>
            <div className={s.titleRow}>
              <div>
                <p className="label">{vehicle.year}</p>
                <h3 className={s.title}>
                  <span className={s.make}>{vehicle.make}</span> {vehicle.model}
                </h3>
                {vehicle.variant && <p className={s.variant}>{vehicle.variant}</p>}
              </div>
            </div>

            <dl className={s.specs}>
              <div>
                <dt className="sr-only">Engine</dt>
                <dd>{vehicle.engine.label}</dd>
              </div>
              <div>
                <dt className="sr-only">Power</dt>
                <dd className="num">{vehicle.engine.powerHp.toLocaleString("en-US")} HP</dd>
              </div>
              <div>
                <dt className="sr-only">Mileage</dt>
                <dd className="num">{formatKm(vehicle.mileageKm)}</dd>
              </div>
            </dl>

            <div className={s.foot}>
              <div>
                <p className="label">{marketName(vehicle.location.countryCode)}</p>
                <p className={s.priceLabel}>Est. landed price</p>
                <p className={`${s.price} num`}>{formatILS(vehicle.estimatedLandedPriceILS)}</p>
              </div>
              <span className={s.cta}>
                View vehicle <ArrowRight width={18} height={18} />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
