"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { markets } from "@/data/markets";
import s from "./Confirmation.module.css";

/**
 * Post-submit moment: seven route lines draw in from the edges and
 * converge on a single point — the brief going out to every market,
 * with Israel as the destination.
 */
export function Confirmation({ reference, summary, channel }: { reference: string; summary: string; channel: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.focus();
    root.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  const angles = markets.map((_, i) => -160 + (i * 140) / (markets.length - 1));

  return (
    <div ref={root} className={s.root} tabIndex={-1} role="status" aria-live="polite">
      <svg className={s.art} viewBox="-200 -130 400 200" aria-hidden="true">
        {angles.map((a, i) => {
          const r = (a * Math.PI) / 180;
          const x = Math.cos(r) * 190;
          const y = Math.sin(r) * 120;
          return (
            <g key={i} style={{ "--i": i } as React.CSSProperties}>
              <path className={s.route} d={`M${x.toFixed(1)} ${y.toFixed(1)} Q ${(x * 0.4).toFixed(1)} ${(y * 0.2 - 40).toFixed(1)} 0 40`} pathLength={1} />
              <circle className={s.origin} cx={x} cy={y} r="2.4" />
              <text className={s.code} x={x} y={y - 8} textAnchor="middle">
                {markets[i].code}
              </text>
            </g>
          );
        })}
        <circle className={s.dest} cx="0" cy="40" r="5" />
        <circle className={s.ring} cx="0" cy="40" r="5" />
        <text className={s.destLabel} x="0" y="64" textAnchor="middle">
          IL
        </text>
      </svg>

      <div className={s.copy}>
        <p className="label">Search opened · Ref {reference}</p>
        <h3 className={s.title}>
          The search
          <br />
          has begun.
        </h3>
        <p className={s.summary}>{summary}</p>
        <ol className={s.next}>
          <li>
            <span>01</span> A specialist reviews your brief and replies by {channel === "whatsapp" ? "WhatsApp" : channel === "phone" ? "phone" : "email"} within one business day.
          </li>
          <li>
            <span>02</span> You receive a realistic landed-cost range and a first read on availability.
          </li>
          <li>
            <span>03</span> We search all seven markets and come back with a shortlist — not a feed.
          </li>
        </ol>
        <div className={s.actions}>
          <Link href="/vehicles" className="link">
            Browse vehicles meanwhile
          </Link>
          <Link href="/import" className="link">
            Estimate import cost
          </Link>
        </div>
      </div>
    </div>
  );
}
