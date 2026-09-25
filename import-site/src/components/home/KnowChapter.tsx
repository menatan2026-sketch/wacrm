"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  caliperOptions,
  environmentOptions,
  getVehicleModel,
  HERO_MODEL_ID,
  interiorOptions,
  paintOptions,
  trimOptions,
  wheelFinishOptions,
} from "@/config/vehicle-models";
import { setStageConfig, useStageConfig, type StageView } from "@/components/three/director";
import { ArrowRight, Close, Door, Hatch, Hood, Light, Rotate, Seat, Spec, Stars } from "@/components/ui/icons";
import c from "./chapter.module.css";
import s from "./KnowChapter.module.css";

const VIEWS: { id: StageView; label: string }[] = [
  { id: "free", label: "Orbit" },
  { id: "front", label: "Front" },
  { id: "side", label: "Profile" },
  { id: "rear", label: "Rear" },
  { id: "top", label: "Above" },
  { id: "cabin", label: "Cabin" },
  { id: "starlight", label: "Starlight" },
];

const TABS = [
  { id: "exterior", label: "Exterior" },
  { id: "interior", label: "Interior" },
  { id: "explore", label: "Explore" },
  { id: "scene", label: "Scene" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const hero = getVehicleModel(HERO_MODEL_ID);

/**
 * Chapter 01 — "You know the car." The stage car becomes a configurator:
 * paint, wheels, calipers, the cabin's hide and trim, opening doors,
 * bonnet and hatch, cameras (including a seat in the cabin) and scene.
 */
export function KnowChapter() {
  const cfg = useStageConfig((x) => x);
  const [tab, setTab] = useState<Tab>("exterior");
  const [specOpen, setSpecOpen] = useState(false);
  const hoverPart = useHoverPart();

  // A camera preset holds until the visitor scrolls on.
  useEffect(() => {
    if (cfg.view === "free") return;
    let startY = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > 140) {
        setStageConfig({ view: "free" });
        startY = window.scrollY;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [cfg.view]);

  const paint = paintOptions.find((p) => p.id === cfg.paint);
  const hide = interiorOptions.find((o) => o.id === cfg.interior);
  const trim = trimOptions.find((o) => o.id === cfg.trim);
  const caliper = caliperOptions.find((o) => o.id === cfg.caliper);
  const wheel = wheelFinishOptions.find((o) => o.id === cfg.wheel);

  const build = [
    paint && `${paint.name} paint`,
    wheel && `${wheel.name} wheels`,
    caliper && `${caliper.name} calipers`,
    hide && `${hide.name} leather`,
    trim && `${trim.name} trim`,
    cfg.starlight && hero?.starlight && "Starlight headliner",
  ].filter(Boolean);
  const sourceHref = `/request?${new URLSearchParams({
    color: paint?.name ?? "",
    message: `Built in the studio: ${build.join(", ")}.`,
  })}`;

  const anyOpen = cfg.doors || cfg.hood || cfg.hatch;

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
            The colour. The hide. The way the doors rise. Build it here — we&apos;ll find the real one.
          </p>

          <div className={`${s.panel} ${c.interactive}`} role="group" aria-label="Studio configurator">
            <div className={s.panelHead}>
              <p className="label label-strong">{hero?.showcase?.name ?? "Studio"}</p>
              <p className="label">{hero?.showcase?.subtitle ?? "Studio model"}</p>
            </div>

            <div className={s.tabs} role="tablist" aria-label="Configurator sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`know-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={`know-panel-${t.id}`}
                  onClick={() => {
                    setTab(t.id);
                    // Interior: take a seat, so the change is visible.
                    if (t.id === "interior" && cfg.view !== "cabin" && !cfg.doors) setStageConfig({ doors: true });
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className={s.tabPanel} role="tabpanel" id={`know-panel-${tab}`} aria-labelledby={`know-tab-${tab}`}>
              {tab === "exterior" && (
                <>
                  <fieldset className={s.group}>
                    <legend className="label">
                      Paint <span className={s.value}>{paint?.name}</span>
                    </legend>
                    <div className={s.swatches}>
                      {paintOptions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={s.swatch}
                          style={{ "--c": p.color } as React.CSSProperties}
                          aria-pressed={cfg.paint === p.id}
                          aria-label={p.name}
                          title={p.name}
                          onClick={() => setStageConfig({ paint: p.id })}
                        />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className={s.group}>
                    <legend className="label">
                      Wheels <span className={s.value}>{wheel?.name}</span>
                    </legend>
                    <div className={s.segmented}>
                      {wheelFinishOptions.map((w) => (
                        <button key={w.id} type="button" aria-pressed={cfg.wheel === w.id} onClick={() => setStageConfig({ wheel: w.id })}>
                          <span className={s.dot} style={{ "--c": w.color } as React.CSSProperties} />
                          {w.name}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className={s.group}>
                    <legend className="label">
                      Calipers <span className={s.value}>{caliper?.name}</span>
                    </legend>
                    <div className={s.swatches}>
                      {caliperOptions.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className={`${s.swatch} ${s.small}`}
                          style={{ "--c": o.color } as React.CSSProperties}
                          aria-pressed={cfg.caliper === o.id}
                          aria-label={`${o.name} calipers`}
                          title={o.name}
                          onClick={() => setStageConfig({ caliper: o.id })}
                        />
                      ))}
                    </div>
                  </fieldset>
                </>
              )}

              {tab === "interior" && (
                <>
                  <fieldset className={s.group}>
                    <legend className="label">
                      Leather <span className={s.value}>{hide?.name}</span>
                    </legend>
                    <div className={s.swatches}>
                      {interiorOptions.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className={`${s.swatch} ${s.hide}`}
                          style={{ "--c": o.leather, "--c2": o.stitch } as React.CSSProperties}
                          aria-pressed={cfg.interior === o.id}
                          aria-label={`${o.name} leather`}
                          title={o.name}
                          onClick={() => setStageConfig({ interior: o.id })}
                        />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className={s.group}>
                    <legend className="label">
                      Trim <span className={s.value}>{trim?.name}</span>
                    </legend>
                    <div className={s.segmented}>
                      {trimOptions.map((o) => (
                        <button key={o.id} type="button" aria-pressed={cfg.trim === o.id} onClick={() => setStageConfig({ trim: o.id })}>
                          {o.name}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {hero?.starlight && (
                    <div className={s.tools} role="group" aria-label="Starlight headliner">
                      <button type="button" className={s.tool} aria-pressed={cfg.starlight} onClick={() => setStageConfig({ starlight: !cfg.starlight })}>
                        <Stars /> Starlight {cfg.starlight ? "on" : "off"}
                      </button>
                      <button
                        type="button"
                        className={s.tool}
                        aria-pressed={cfg.view === "starlight"}
                        onClick={() => setStageConfig(cfg.view === "starlight" ? { view: "free" } : { view: "starlight", starlight: true })}
                      >
                        Look up
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className={`${s.tool} ${s.wide}`}
                    aria-pressed={cfg.view === "cabin"}
                    onClick={() => setStageConfig({ view: cfg.view === "cabin" ? "free" : "cabin" })}
                  >
                    <Seat /> {cfg.view === "cabin" ? "Step out" : "Take a seat"}
                  </button>
                </>
              )}

              {tab === "explore" && (
                <>
                  <div className={s.tools} role="group" aria-label="Open the car">
                    <button type="button" className={s.tool} aria-pressed={cfg.doors} onClick={() => setStageConfig(cfg.doors ? { doors: false } : { doors: true, view: cfg.view === "cabin" ? "free" : cfg.view })} data-hot={hoverPart === "doorL" || hoverPart === "doorR"}>
                      <Door /> Doors
                    </button>
                    <button type="button" className={s.tool} aria-pressed={cfg.hood} onClick={() => setStageConfig(cfg.hood ? { hood: false, view: "free" } : { hood: true, view: "frunk" })} data-hot={hoverPart === "hood"}>
                      <Hood /> Bonnet
                    </button>
                    <button type="button" className={s.tool} aria-pressed={cfg.hatch} onClick={() => setStageConfig(cfg.hatch ? { hatch: false, view: "free" } : { hatch: true, view: "engine" })} data-hot={hoverPart === "hatch"}>
                      <Hatch /> Rear hatch
                    </button>
                    <button type="button" className={s.tool} aria-pressed={cfg.lights} onClick={() => setStageConfig({ lights: !cfg.lights })}>
                      <Light /> Lights
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`${s.tool} ${s.wide}`}
                    onClick={() => setStageConfig(anyOpen ? { doors: false, hood: false, hatch: false } : { doors: true, hood: true, hatch: true })}
                  >
                    {anyOpen ? "Close everything" : "Open everything"}
                  </button>
                  <fieldset className={s.group}>
                    <legend className="label">Camera</legend>
                    <div className={s.segmented}>
                      {VIEWS.map((v) => (
                        <button key={v.id} type="button" aria-pressed={cfg.view === v.id} onClick={() => setStageConfig({ view: v.id })}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <p className={s.tip}>Tip — click a door, the bonnet or the hatch on the car itself.</p>
                </>
              )}

              {tab === "scene" && (
                <fieldset className={s.group}>
                  <legend className="label">Environment</legend>
                  <div className={s.segmented}>
                    {environmentOptions.map((e) => (
                      <button key={e.id} type="button" aria-pressed={cfg.env === e.id} onClick={() => setStageConfig({ env: e.id })}>
                        {e.name}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>

            <div className={s.tools}>
              <button type="button" className={s.tool} aria-expanded={specOpen} onClick={() => setSpecOpen((o) => !o)}>
                <Spec /> Specification
              </button>
              <button
                type="button"
                className={s.tool}
                onClick={() => setStageConfig({ view: "free", doors: false, hood: false, hatch: false })}
              >
                <Rotate /> Reset view
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
                {(hero?.showcase?.spec ?? []).map(([k, v]) => (
                  <div key={k}>
                    <dt className="label">{k}</dt>
                    <dd className="num">{v}</dd>
                  </div>
                ))}
                <div>
                  <dt className="label">Your build</dt>
                  <dd className={s.build}>{build.join(" · ")}</dd>
                </div>
              </dl>
            </div>

            <Link href={sourceHref} className={s.source} data-cursor="open">
              Source this spec <ArrowRight width={18} height={18} />
            </Link>
          </div>

          <p className={`label ${s.hint}`} aria-hidden="true">
            <Rotate width={16} height={16} /> Drag to rotate · click to open
          </p>
        </div>
      </div>
    </section>
  );
}

/** Mirrors the stage's hovered part (set on <body>) for button highlights. */
function useHoverPart() {
  const [part, setPart] = useState<string | null>(null);
  useEffect(() => {
    const obs = new MutationObserver(() => setPart(document.body.dataset.hoverPart ?? null));
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-hover-part"] });
    return () => obs.disconnect();
  }, []);
  return part;
}
