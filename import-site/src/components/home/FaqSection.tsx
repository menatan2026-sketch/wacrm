import { faqs } from "@/data/content";
import { Plus } from "@/components/ui/icons";
import { RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";
import s from "./FaqSection.module.css";

/** The questions every buyer asks before the first call — answered in two lines each. */
export function FaqSection() {
  return (
    <section id="faq" className={`${c.plate} ${c.sectionPad}`} aria-labelledby="faq-title">
      <div className={`container ${s.grid}`}>
        <div className={s.side}>
          <p className={c.index}>Questions</p>
          <RevealText id="faq-title" className="display-m" lines={["Straight", "answers."]} />
        </div>
        <div className={s.list}>
          {faqs.map((f, i) => (
            <details key={f.q} className={s.item} open={i === 0}>
              <summary className={s.q}>
                <span>{f.q}</span>
                <Plus className={s.icon} width={18} height={18} />
              </summary>
              <p className={s.a}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
      <script
        type="application/ld+json"
        // FAQ rich results for search engines.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }),
        }}
      />
    </section>
  );
}
