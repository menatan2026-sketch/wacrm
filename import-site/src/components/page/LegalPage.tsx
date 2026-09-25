import { PageHeader } from "./PageHeader";
import s from "./LegalPage.module.css";

export interface LegalSection {
  heading: string;
  body: string[];
}

/** Shared layout for legal copy. Content is a template — have counsel review it before launch. */
export function LegalPage({ index, title, updated, intro, sections }: { index: string; title: string[]; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className={s.page}>
      <PageHeader index={index} title={title} lede={intro} />
      <div className={`container ${s.body}`}>
        <p className="label">Last updated {updated}</p>
        {sections.map((sec) => (
          <section key={sec.heading}>
            <h2>{sec.heading}</h2>
            {sec.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
