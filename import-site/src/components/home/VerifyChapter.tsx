"use client";

import { useEffect, useRef } from "react";
import { verificationLabels } from "@/data/content";
import type { VerificationKey } from "@/domain/types";
import { registerHud } from "@/components/three/director";
import c from "./chapter.module.css";
import s from "./VerifyChapter.module.css";

interface Stop {
  anchor: "frontWheel" | "headlight" | "cockpit" | "vin" | "engine";
  from: number;
  to: number;
  title: string;
  reading: string;
  status: "Verified" | "Reported" | "Inspected";
  side: "left" | "right";
}

// Windows match the camera stops in poses.ts (verify chapter).
const STOPS: Stop[] = [
  { anchor: "frontWheel", from: 0.21, to: 0.36, title: "Mechanical condition", reading: "Brakes 82% · Tyres 6.1 mm · No leaks", status: "Inspected", side: "right" },
  { anchor: "headlight", from: 0.37, to: 0.52, title: "Accident history", reading: "Paint depth 118–134 µm on every panel", status: "Verified", side: "right" },
  { anchor: "cockpit", from: 0.53, to: 0.68, title: "Mileage", reading: "Odometer matches 9 dated records", status: "Verified", side: "right" },
  { anchor: "vin", from: 0.69, to: 0.82, title: "Specification & documents", reading: "VIN decoded · Build sheet · Title", status: "Verified", side: "right" },
  { anchor: "engine", from: 0.83, to: 0.94, title: "Service history", reading: "Main-dealer stamps matched to invoices", status: "Reported", side: "right" },
];

const CHECKS: { key: VerificationKey; at: number }[] = [
  { key: "history", at: 0.19 },
  { key: "ownership", at: 0.24 },
  { key: "mechanical", at: 0.3 },
  { key: "accidents", at: 0.45 },
  { key: "mileage", at: 0.6 },
  { key: "specification", at: 0.74 },
  { key: "documentation", at: 0.78 },
  { key: "service", at: 0.89 },
];

function HudTag({ stop, index }: { stop: Stop; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return registerHud(`verify-${stop.anchor}`, { el: ref.current, key: `car:${stop.anchor}` });
  }, [stop.anchor]);
  return (
    <div
      ref={ref}
      className={s.tag}
      data-side={stop.side}
      style={{ "--a": stop.from, "--b": stop.to } as React.CSSProperties}
    >
      <span className={s.target} />
      <span className={s.leader} />
      <div className={s.card}>
        <p className={s.tagIndex}>
          {String(index + 1).padStart(2, "0")} / {String(STOPS.length).padStart(2, "0")}
        </p>
        <p className={s.tagTitle}>{stop.title}</p>
        <p className={s.reading}>{stop.reading}</p>
        <p className={s.status} data-status={stop.status}>
          {stop.status}
        </p>
      </div>
    </div>
  );
}

/**
 * Chapter 03 — "We verify it." The globe folds back into the car and
 * the camera walks the inspection: wheels, paint, odometer, VIN, engine.
 */
export function VerifyChapter() {
  return (
    <section className={`${c.chapter} ${s.verify}`} data-chapter="verify" aria-labelledby="verify-title">
      <div className={c.sticky}>
        <div className={s.tags} aria-hidden="true">
          {STOPS.map((stop, i) => (
            <HudTag key={stop.anchor} stop={stop} index={i} />
          ))}
        </div>

        <div className={`container ${s.frame}`}>
          <header className={s.head}>
            <p className={c.index}>03 — Verification</p>
            <h2 id="verify-title" className="display-l">
              We verify
              <br />
              it.
            </h2>
          </header>

          <aside className={s.checklist} aria-label="Verification checklist">
            <p className="label label-strong">Inspection file</p>
            <ol>
              {CHECKS.map((ch) => (
                <li key={ch.key} style={{ "--t": ch.at } as React.CSSProperties}>
                  <span className={s.box} />
                  <span>{verificationLabels[ch.key].title}</span>
                  <span className={s.source}>{verificationLabels[ch.key].source}</span>
                </li>
              ))}
            </ol>
            <p className={s.note}>Sample readings shown. Every vehicle gets its own file — verified facts and estimates are labelled separately.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
