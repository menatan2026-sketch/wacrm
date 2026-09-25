import { verificationLabels } from "@/data/content";
import type { VerificationKey } from "@/domain/types";
import { Check } from "@/components/ui/icons";
import { Reveal, RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./TrustSection.module.css";

const LEGEND = [
  { key: "verified", label: "Verified", text: "checked against a document" },
  { key: "reported", label: "Reported", text: "seller's word, flagged until proven" },
  { key: "estimate", label: "Estimate", text: "calculated, with its range" },
] as const;

const ORDER: VerificationKey[] = ["history", "mileage", "ownership", "accidents", "service", "mechanical", "specification", "documentation"];

/** What we check — eight checks, each tied to its source, with honest labels. */
export function TrustSection() {
  return (
    <section className={`${c.plate} ${c.sectionPad}`} aria-labelledby="trust-title">
      <div className="container">
        <div className={c.sectionHead}>
          <div className={s.titleWrap}>
            <p className={c.index}>What we check</p>
            <RevealText id="trust-title" className="display-m" lines={["Eight checks.", "Before you pay."]} />
          </div>
          <div className={s.intro}>
            <p className="body-l">Every car gets a written inspection file. Every line tells you how we know it.</p>
            <ul className={s.legend}>
              {LEGEND.map((l) => (
                <li key={l.key} data-kind={l.key}>
                  <span className={s.legendLabel}>{l.label}</span> {l.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ol className={s.grid}>
          {ORDER.map((key, i) => {
            const v = verificationLabels[key];
            return (
              <Reveal as="li" key={key} className={`fade-up ${s.item}`} style={{ "--d": `${(i % 4) * 70}ms` } as React.CSSProperties}>
                <span className={s.check}>
                  <Check width={16} height={16} />
                </span>
                <h3 className={s.itemTitle}>{v.title}</h3>
                <p className={s.itemText}>{v.description}</p>
                <span className={s.src}>{v.source}</span>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
