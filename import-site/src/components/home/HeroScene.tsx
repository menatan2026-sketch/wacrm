import Link from "next/link";
import { markets, DESTINATION } from "@/data/markets";
import { ArrowRight } from "@/components/ui/icons";
import { Magnetic } from "@/components/ui/Magnetic";
import { RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./HeroScene.module.css";

function coord(lat: number, lng: number) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
}

/**
 * Chapter 00 — Desire. Typography over the studio car; the camera
 * begins to orbit as you scroll and hands over to the configurator.
 */
export function HeroScene() {
  return (
    <section className={`${c.chapter} ${s.hero}`} data-chapter="hero" aria-labelledby="hero-title">
      <div className={c.sticky}>
        <div className={`container ${s.frame}`}>
          <div className={s.topline}>
            <p className="label">Personal vehicle sourcing &amp; import · Israel</p>
            <p className={`label ${s.coords}`}>
              {DESTINATION.hub} — {coord(DESTINATION.lat, DESTINATION.lng)}
            </p>
          </div>

          <div className={s.bottom}>
            <RevealText as="h1" id="hero-title" className={`display-xl ${s.title}`} lines={["Your car.", "From anywhere."]} threshold={0} />
            <div className={s.row}>
              <p className={`body-l ${s.lede}`}>
                Personal vehicle sourcing and import — built around the exact car you want.
              </p>
              <div className={`${s.ctas} ${c.interactive}`}>
                <Magnetic>
                  <Link href="/vehicles?intent=find" className="btn btn-primary" data-cursor="open">
                    Find my car <ArrowRight className="btn-arrow" />
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link href="/vehicles" className="btn btn-ghost" data-cursor="explore">
                    Explore vehicles
                  </Link>
                </Magnetic>
              </div>
            </div>
          </div>

          <ul className={s.routes} aria-label="Sourcing markets">
            {markets.map((m, i) => (
              <li key={m.code} style={{ "--i": i } as React.CSSProperties}>
                <span className={s.code}>{m.code}</span>
                <span className={s.city}>{m.hub}</span>
                <span className={s.line} />
                <span className={s.code}>IL</span>
              </li>
            ))}
          </ul>

        </div>
      </div>
    </section>
  );
}
