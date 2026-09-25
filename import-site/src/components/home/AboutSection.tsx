import { RevealText, Reveal } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./AboutSection.module.css";

const PRINCIPLES = [
  {
    title: "We work for the buyer",
    text: "No stock to clear and no showroom to fill. Our only inventory is your brief, so our only incentive is finding the right car.",
  },
  {
    title: "Estimates, labelled as estimates",
    text: "Every number we give you shows its basis and its range. When rules or rates move, we tell you before they reach your invoice.",
  },
  {
    title: "One specialist, start to finish",
    text: "The person who takes your first call is the person who hands you the keys. No hand-offs, no call centres.",
  },
];

/** About — the stance behind the service. */
export function AboutSection() {
  return (
    <section id="about" className={`${c.plate} ${c.sectionPad}`} aria-labelledby="about-title">
      <div className="container">
        <p className={c.index}>About</p>
        <RevealText
          id="about-title"
          className={`display-l ${s.statement}`}
          lines={["An import desk,", "not a dealership."]}
        />
        <div className={s.grid}>
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} className={`fade-up ${s.item}`} style={{ "--d": `${i * 120}ms` } as React.CSSProperties}>
              <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className={s.title}>{p.title}</h3>
              <p className={s.text}>{p.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
