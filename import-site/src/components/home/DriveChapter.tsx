import Link from "next/link";
import { whatsappHref } from "@/config/site";
import { ArrowRight, WhatsApp } from "@/components/ui/icons";
import { Magnetic } from "@/components/ui/Magnetic";
import c from "./chapter.module.css";
import s from "./DriveChapter.module.css";

/** Chapter 05 — Arrival. Dusk, headlights, Israeli plates. */
export function DriveChapter() {
  return (
    <section className={`${c.chapter} ${s.drive}`} data-chapter="drive" aria-labelledby="drive-title">
      <div className={c.sticky}>
        <div className={`container ${s.frame}`}>
          <p className={c.index}>05 — Arrival</p>
          <div className={s.bottom}>
            <h2 id="drive-title" className="display-l">
              You drive
              <br />
              it.
            </h2>
            <div className={s.row}>
              <p className="body-l">
                Tested, plated and delivered to your door.
              </p>
              <div className={`${s.ctas} ${c.interactive}`}>
                <Magnetic>
                  <Link href="/request" className="btn btn-primary" data-cursor="open">
                    Get a free quote <ArrowRight className="btn-arrow" />
                  </Link>
                </Magnetic>
                <a href={whatsappHref("Hi Portolan — I'd like to talk about importing a car.")} className="btn btn-ghost" target="_blank" rel="noreferrer">
                  <WhatsApp width={18} height={18} /> Talk to a specialist
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
