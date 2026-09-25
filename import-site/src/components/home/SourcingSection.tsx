import { ContactForm } from "@/components/forms/ContactForm";
import { RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./SourcingSection.module.css";

/** "We find it for you" — the primary lead form, placed after arrival. */
export function SourcingSection() {
  return (
    <section id="contact" className={`${c.plate} ${c.sectionPad}`} aria-labelledby="sourcing-title">
      <div className={`container ${s.grid}`}>
        <div className={s.side}>
          <p className={c.index}>We find it for you</p>
          <RevealText id="sourcing-title" className="display-m" lines={["Can't find", "the right car?"]} />
          <p className="body-l">
            Tell us exactly what you&apos;re looking for. We&apos;ll search international markets and build the route to your
            driveway.
          </p>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
