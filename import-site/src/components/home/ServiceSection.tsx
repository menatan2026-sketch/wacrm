import Link from "next/link";
import type { JourneyStep, Service } from "@/domain/types";
import { ArrowUpRight } from "@/components/ui/icons";
import { RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./ServiceSection.module.css";

/**
 * Services as an editorial index — each line names the journey step it
 * belongs to, so the list reads as the story you just scrolled through.
 */
export function ServiceSection({ services, steps }: { services: Service[]; steps: JourneyStep[] }) {
  return (
    <section id="services" className={`${c.plate} ${c.sectionPad}`} aria-labelledby="services-title">
      <div className="container">
        <div className={c.sectionHead}>
          <div className={s.titleWrap}>
            <p className={c.index}>Services</p>
            <RevealText id="services-title" className="display-m" lines={["Everything between", "the listing and", "your driveway."]} />
          </div>
          <p className="body-l">
            One specialist owns your import end to end. Take the whole journey, or just the part you need — an inspection in
            Munich, a container from Jebel Ali, the paperwork at Haifa.
          </p>
        </div>

        <ol className={s.index}>
          {services.map((sv, i) => {
            const step = steps.find((st) => st.key === sv.journeyStep);
            return (
              <li key={sv.key} className={s.row} tabIndex={0}>
                <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className={s.title}>{sv.title}</h3>
                <span className={s.step}>
                  Step {String(step?.index ?? 0).padStart(2, "0")} · {step?.title}
                </span>
                <div className={s.more}>
                  <div>
                    <p className={s.summary}>{sv.summary}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className={s.foot}>
          <p className="label">Need one part of the journey?</p>
          <Link href="/request?service=specialist" className="link" data-cursor="open">
            Talk to an import specialist <ArrowUpRight width={14} height={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
