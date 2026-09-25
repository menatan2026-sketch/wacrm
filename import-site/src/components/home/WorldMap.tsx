"use client";

import { useEffect, useRef } from "react";
import type { Market } from "@/domain/types";
import { registerHud, setStageConfig, useStageConfig } from "@/components/three/director";
import c from "./chapter.module.css";
import s from "./WorldMap.module.css";

function GlobeLabel({ code, name, destination = false }: { code: string; name: string; destination?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useStageConfig((cfg) => cfg.market === code);
  useEffect(() => {
    if (!ref.current) return;
    return registerHud(`label-${code}`, { el: ref.current, key: `market:${code}` });
  }, [code]);
  return (
    <div ref={ref} className={s.label} data-active={active} data-destination={destination}>
      <span className={s.pin} />
      <span className={s.labelText}>
        <b>{code}</b> {name}
      </span>
    </div>
  );
}

/**
 * Chapter 02 — "We find it." The studio floor falls away into a globe;
 * routes draw from every market into Israel. Hover or tap a market for
 * what we typically source there.
 */
export function WorldMap({ markets, counts }: { markets: Market[]; counts: Record<string, number> }) {
  const selected = useStageConfig((cfg) => cfg.market);
  const market = markets.find((m) => m.code === selected) ?? null;

  return (
    <section className={`${c.chapter} ${s.find}`} data-chapter="find" aria-labelledby="find-title">
      <div className={c.sticky}>
        <div className={s.labels} aria-hidden="true">
          {markets.map((m) => (
            <GlobeLabel key={m.code} code={m.code} name={m.name} />
          ))}
          <GlobeLabel code="IL" name="Destination" destination />
        </div>

        <div className={`container ${s.frame}`}>
          <header className={s.head}>
            <p className={c.index}>02 — Discovery</p>
            <h2 id="find-title" className="display-l">
              We find
              <br />
              it.
            </h2>
            <p className={`body-l ${s.copy}`}>
              Seven markets, searched at once — dealers, auctions and private sellers.
            </p>
          </header>

          <div className={`${s.markets} ${c.interactive}`}>
            <ul className={s.list} role="list">
              {markets.map((m) => (
                <li key={m.code}>
                  <button
                    type="button"
                    aria-pressed={selected === m.code}
                    onMouseEnter={() => setStageConfig({ market: m.code })}
                    onFocus={() => setStageConfig({ market: m.code })}
                    onClick={() => setStageConfig({ market: m.code })}
                  >
                    <span className={s.code}>{m.code}</span>
                    <span className={s.name}>{m.name}</span>
                    <span className={s.days}>
                      {m.transitDays[0]}–{m.transitDays[1]}d
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className={s.panel} aria-live="polite">
              {market ? (
                <div key={market.code} className={s.panelInner}>
                  <div className={s.panelHead}>
                    <p className="label">Country</p>
                    <p className="label">{market.hub} → Haifa / Ashdod</p>
                  </div>
                  <h3 className={s.country}>{market.name}</h3>
                  <dl className={s.facts}>
                    <div>
                      <dt className="label">Available now</dt>
                      <dd className="num">
                        {counts[market.code] ?? 0} {counts[market.code] === 1 ? "vehicle" : "vehicles"}
                      </dd>
                    </div>
                    <div>
                      <dt className="label">Typical transit</dt>
                      <dd className="num">
                        {market.transitDays[0]}–{market.transitDays[1]} days
                      </dd>
                    </div>
                  </dl>
                  <p className={s.typical}>{market.typicalMarket}</p>
                  <div className={s.block}>
                    <p className="label">Import advantages</p>
                    <ul>
                      {market.advantages.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={s.block}>
                    <p className="label">Example vehicles</p>
                    <p className={s.examples}>{market.exampleVehicles.join(" · ")}</p>
                  </div>
                </div>
              ) : (
                <p className={`label ${s.prompt}`}>Select a market to see what we source there</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
