import Link from "next/link";
import type { JourneyStep, Service } from "@/domain/types";
import { ArrowRight } from "@/components/ui/icons";
import { Reveal, RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./ServiceSection.module.css";

/** Everything handled — the full service at a glance, each tied to its journey step. */
export function ServiceSection({ services, steps }: { services: Service[]; steps: JourneyStep[] }) {
  return (
    <section id="services" className={`${c.plate} ${c.sectionPad}`} aria-labelledby="services-title">
      <div className="container">
        <div className={c.sectionHead}>
          <div className={s.titleWrap}>
            <p className={c.index}>Services</p>
            <RevealText id="services-title" className="display-m" lines={["Everything", "handled."]} />
          </div>
          <p className="body-l">Take the whole journey or just the part you need — one specialist either way.</p>
        </div>

        <ol className={s.grid}>
          {services.map((sv, i) => {
            const step = steps.find((st) => st.key === sv.journeyStep);
            return (
              <Reveal as="li" key={sv.key} className={`fade-up ${s.tile}`} style={{ "--d": `${(i % 3) * 80}ms` } as React.CSSProperties}>
                <span className={s.step}>
                  {String(i + 1).padStart(2, "0")} · {step?.title}
                </span>
                <h3 className={s.title}>{sv.title}</h3>
                <p className={s.summary}>{sv.summary}</p>
              </Reveal>
            );
          })}
        </ol>

        <div className={s.foot}>
          <p className="body-l">Need only one part — an inspection abroad, shipping, or the paperwork?</p>
          <Link href="/request?service=specialist" className="btn btn-ghost" data-cursor="open">
            Talk to a specialist <ArrowRight className="btn-arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}
