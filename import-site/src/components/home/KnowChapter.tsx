"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { environmentOptions, paintOptions, wheelFinishOptions } from "@/config/vehicle-models";
import type { Vehicle } from "@/domain/types";
import { drivetrainLabel, transmissionLabel } from "@/lib/format";
import { setStageConfig, useStageConfig, type StageConfig } from "@/components/three/director";
import { ArrowRight, Close, Light, Rotate, Spec } from "@/components/ui/icons";
import c from "./chapter.module.css";
import s from "./KnowChapter.module.css";

const VIEWS: { id: StageConfig["view"]; label: string }[] = [
  { id: "free", label: "Orbit" },
  { id: "front", label: "Front" },
  { id: "side", label: "Profile" },
  { id: "rear", label: "Rear" },
  { id: "top", label: "Above" },
];

/**
 * Chapter 01 — "You know the car." The stage car becomes a configurator:
 * drag to rotate, change paint, wheels, light and camera.
 */
export function KnowChapter({ vehicle }: { vehicle: Vehicle | null }) {
  const paint = useStageConfig((c) => c.paint);
  const wheel = useStageConfig((c) => c.wheel);
  const env = useStageConfig((c) => c.env);
  const lights = useStageConfig((c) => c.lights);
  const view = useStageConfig((c) => c.view);
  const [specOpen, setSpecOpen] = useState(false);

  // A camera preset holds until the visitor scrolls on.
  useEffect(() => {
    if (view === "free") return;
    let startY = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > 140) {
        setStageConfig({ view: "free" });
        startY = window.scrollY;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [view]);

  const paintName = paintOptions.find((p) => p.id === paint)?.name ?? "";
  const specs = vehicle
    ? [
        ["Engine", vehicle.engine.label],
        ["Power", `${vehicle.engine.powerHp} hp`],
        ["Torque", `${vehicle.engine.torqueNm} Nm`],
        ["0–100 km/h", `${vehicle.acceleration0to100s.toFixed(1)} s`],
        ["Transmission", transmissionLabel[vehicle.transmission]],
        ["Drivetrain", drivetrainLabel[vehicle.drivetrain]],
      ]
    : [];

  const sourceHref = `/request?${new URLSearchParams({
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    color: paintName,
  })}`;

  return (
    <section className={`${c.chapter} ${s.know}`} data-chapter="know" aria-labelledby="know-title">
      <div className={c.sticky}>
        <div className={`container ${s.frame}`}>
          <header className={s.head}>
            <p className={c.index}>01 — Desire</p>
            <h2 id="know-title" className="display-l">
              You know
              <br />
              the car.
            </h2>
          </header>

          <p className={`body-l ${s.copy}`}>
            The colour. The wheels. The way light moves across it. Build it here — we&apos;ll find the real one.
          </p>

          <div className={`${s.panel} ${c.interactive}`} role="group" aria-label="Studio configurator">
            <div className={s.panelHead}>
              <p className="label label-strong">Studio</p>
              <p className="label">{vehicle ? `${vehicle.make} ${vehicle.model}` : "Studio model"}</p>
            </div>

            <fieldset className={s.group}>
              <legend className="label">
                Paint <span className={s.value}>{paintName}</span>
              </legend>
              <div className={s.swatches}>
                {paintOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={s.swatch}
                    style={{ "--c": p.color } as React.CSSProperties}
                    aria-pressed={paint === p.id}
                    aria-label={p.name}
                    title={p.name}
                    onClick={() => setStageConfig({ paint: p.id })}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className={s.group}>
              <legend className="label">Wheels</legend>
              <div className={s.segmented}>
                {wheelFinishOptions.map((w) => (
                  <button key={w.id} type="button" aria-pressed={wheel === w.id} onClick={() => setStageConfig({ wheel: w.id })}>
                    <span className={s.dot} style={{ "--c": w.color } as React.CSSProperties} />
                    {w.name}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className={s.group}>
              <legend className="label">Environment</legend>
              <div className={s.segmented}>
                {environmentOptions.map((e) => (
                  <button key={e.id} type="button" aria-pressed={env === e.id} onClick={() => setStageConfig({ env: e.id })}>
                    {e.name}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className={s.group}>
              <legend className="label">Camera</legend>
              <div className={s.segmented}>
                {VIEWS.map((v) => (
                  <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setStageConfig({ view: v.id })}>
                    {v.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className={s.tools}>
              <button type="button" className={s.tool} aria-pressed={lights} onClick={() => setStageConfig({ lights: !lights })}>
                <Light /> Lights {lights ? "on" : "off"}
              </button>
              <button type="button" className={s.tool} aria-expanded={specOpen} onClick={() => setSpecOpen((o) => !o)}>
                <Spec /> Specification
              </button>
            </div>

            <div className={s.spec} data-open={specOpen} aria-hidden={!specOpen}>
              <div className={s.specHead}>
                <p className="label label-strong">Specification</p>
                <button type="button" onClick={() => setSpecOpen(false)} aria-label="Close specification" tabIndex={specOpen ? 0 : -1}>
                  <Close width={18} height={18} />
                </button>
              </div>
              <dl>
                {specs.map(([k, v]) => (
                  <div key={k}>
                    <dt className="label">{k}</dt>
                    <dd className="num">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <Link href={sourceHref} className={s.source} data-cursor="open">
              Source this spec <ArrowRight width={18} height={18} />
            </Link>
          </div>

          <p className={`label ${s.hint}`} aria-hidden="true">
            <Rotate width={16} height={16} /> Drag the car to rotate
          </p>
        </div>
      </div>
    </section>
  );
}
