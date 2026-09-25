import { guarantees, journey, verificationLabels } from "@/data/content";
import { markets } from "@/data/markets";
import { Inspect, Person, Receipt, Shield } from "@/components/ui/icons";
import { Reveal, RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./AboutSection.module.css";

const ICONS = { price: Receipt, inspection: Inspect, specialist: Person, insured: Shield } as const;

/**
 * Why us — the commitments every client gets, plus a few hard numbers
 * that come straight from the service itself (no invented statistics).
 */
export function AboutSection() {
  const facts = [
    { value: String(markets.length), label: "Sourcing markets" },
    { value: String(Object.keys(verificationLabels).length), label: "Checks on every car" },
    { value: String(journey.length), label: "Steps handled for you" },
    { value: "1", label: "Specialist, start to finish" },
  ];
  return (
    <section id="about" className={`${c.plate} ${c.sectionPad}`} aria-labelledby="about-title">
      <div className="container">
        <div className={c.sectionHead}>
          <div className={s.titleWrap}>
            <p className={c.index}>Why Portolan</p>
            <RevealText id="about-title" className="display-m" lines={["We work for", "the buyer."]} />
          </div>
          <p className="body-l">No stock to push. Our only job is getting you the right car at the right price.</p>
        </div>

        <div className={s.grid}>
          {guarantees.map((g, i) => {
            const Icon = ICONS[g.key];
            return (
              <Reveal key={g.key} className={`fade-up ${s.card}`} style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
                <Icon className={s.icon} width={28} height={28} />
                <h3 className={s.title}>{g.title}</h3>
                <p className={s.text}>{g.text}</p>
              </Reveal>
            );
          })}
        </div>

        <dl className={s.facts}>
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="label">{f.label}</dt>
              <dd className={s.factValue}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
