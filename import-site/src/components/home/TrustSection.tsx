import { verificationLabels } from "@/data/content";
import type { VerificationKey } from "@/domain/types";
import { Reveal, RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./TrustSection.module.css";

const LEGEND = [
  { key: "verified", label: "Verified", text: "Checked against a primary document or an inspection we commissioned." },
  { key: "reported", label: "Reported", text: "Stated by the seller. We've requested the document; we say so until it arrives." },
  { key: "estimate", label: "Estimate", text: "Calculated from current rules and rates. It can change, and we show the range." },
] as const;

const ORDER: VerificationKey[] = ["history", "mileage", "ownership", "accidents", "service", "mechanical", "specification", "documentation"];

/** Trust — how verification works, in plain language, with honest labels. */
export function TrustSection() {
  return (
    <section className={`${c.plate} ${c.sectionPad}`} aria-labelledby="trust-title">
      <div className={`container ${s.grid}`}>
        <div className={s.side}>
          <p className={c.index}>Trust</p>
          <RevealText id="trust-title" className="display-m" lines={["Verified is", "a word we use", "carefully."]} />
          <p className="body-l">
            A six-figure car bought from another continent deserves more than an advert and a promise. Every claim on a Portolan
            file carries a label that tells you how we know it.
          </p>
          <ul className={s.legend}>
            {LEGEND.map((l) => (
              <li key={l.key} data-kind={l.key}>
                <span className={s.legendLabel}>{l.label}</span>
                <span className={s.legendText}>{l.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <ol className={s.list}>
          {ORDER.map((key, i) => {
            const v = verificationLabels[key];
            return (
              <Reveal as="li" key={key} className={s.item} threshold={0.4}>
                <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
                <div className={s.itemBody}>
                  <h3 className={s.itemTitle}>{v.title}</h3>
                  <p className={s.itemText}>{v.description}</p>
                </div>
                <span className={s.src}>{v.source}</span>
                <span className={s.rule} />
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
