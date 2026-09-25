import Link from "next/link";
import { whatsappHref } from "@/config/site";
import { ArrowRight, Check, WhatsApp } from "@/components/ui/icons";
import { Magnetic } from "@/components/ui/Magnetic";
import { RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./HeroScene.module.css";

const PROOF = ["Independent inspection", "Landed price in writing", "Insured door to door"];


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
            <p className="label">Private car import to Israel</p>
            <p className={`label ${s.coords}`}>Europe · USA · UAE · Japan → Haifa</p>
          </div>

          <div className={s.bottom}>
            <RevealText as="h1" id="hero-title" className={`display-xl ${s.title}`} lines={["Your car.", "From anywhere."]} threshold={0} />
            <div className={s.row}>
              <div className={s.pitch}>
                <p className={`body-l ${s.lede}`}>
                  We find, inspect and import the exact car you want — to your door, at a price you approve in writing.
                </p>
                <ul className={s.proof} aria-label="What every client gets">
                  {PROOF.map((p) => (
                    <li key={p}>
                      <Check width={14} height={14} /> {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`${s.ctas} ${c.interactive}`}>
                <Magnetic>
                  <Link href="/request" className="btn btn-primary" data-cursor="open">
                    Get a free quote <ArrowRight className="btn-arrow" />
                  </Link>
                </Magnetic>
                <a href={whatsappHref("Hi — I'd like a quote for importing a car.")} className="btn btn-ghost" target="_blank" rel="noreferrer">
                  <WhatsApp width={18} height={18} /> WhatsApp
                </a>
              </div>
            </div>
          </div>



        </div>
      </div>
    </section>
  );
}
