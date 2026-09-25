import { ContactForm } from "@/components/forms/ContactForm";
import { whatsappHref } from "@/config/site";
import { Check, WhatsApp } from "@/components/ui/icons";
import { RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./SourcingSection.module.css";

/** "We find it for you" — the primary lead form, placed after arrival. */
export function SourcingSection() {
  return (
    <section id="contact" className={`${c.plate} ${c.sectionPad}`} aria-labelledby="sourcing-title">
      <div className={`container ${s.grid}`}>
        <div className={s.side}>
          <p className={c.index}>Free quote</p>
          <RevealText id="sourcing-title" className="display-m" lines={["Tell us", "the car."]} />
          <p className="body-l">We&apos;ll come back with options and a landed price.</p>
          <ul className={s.promises}>
            {["Reply within one business day", "Free, no obligation", "No deposit to talk"].map((t) => (
              <li key={t}>
                <Check width={16} height={16} /> {t}
              </li>
            ))}
          </ul>
          <a href={whatsappHref("Hi — I'd like a quote for importing a car.")} className={s.wa} target="_blank" rel="noreferrer">
            <WhatsApp width={18} height={18} /> Prefer WhatsApp? Message us
          </a>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
