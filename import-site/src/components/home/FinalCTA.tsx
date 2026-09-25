import Link from "next/link";
import { ArrowRight } from "@/components/ui/icons";
import { Magnetic } from "@/components/ui/Magnetic";
import c from "./chapter.module.css";
import s from "./FinalCTA.module.css";

/**
 * The last shot: the car drives out of the dark toward the camera, the
 * frame fades to black, and the promise lands.
 */
export function FinalCTA() {
  return (
    <section className={`${c.chapter} ${s.final}`} data-chapter="final" aria-labelledby="final-title">
      <div className={c.sticky}>
        <div className={`container ${s.frame}`}>
          <h2 id="final-title" className={`display-l ${s.line1}`}>
            The car you want
            <br />
            is out there.
          </h2>
          <p className={`display-s ${s.line2}`}>Let&apos;s bring it home.</p>
          <div className={`${s.ctas} ${c.interactive}`}>
            <Magnetic>
              <Link href="/request" className="btn btn-primary" data-cursor="open">
                Get a free quote <ArrowRight className="btn-arrow" />
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
    </section>
  );
}
