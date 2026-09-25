import type { JourneyStep, Service } from "@/domain/types";
import c from "./chapter.module.css";
import s from "./ImportJourney.module.css";

/**
 * Chapter 04 — "We bring it home." A pinned, scroll-driven timeline of
 * the eight import steps. The stage behind acts each one out: scanner,
 * reservation ring, container, customs gate, Israeli plates, dawn.
 */
export function ImportJourney({ steps, services }: { steps: JourneyStep[]; services: Service[] }) {
  return (
    <section id="journey" className={`${c.chapter} ${s.bring}`} data-chapter="bring" aria-labelledby="journey-title">
      <div className={c.sticky}>
        <div className={`container ${s.frame}`}>
          <header className={s.head}>
            <p className={c.index}>04 — The import</p>
            <h2 id="journey-title" className="display-l">
              We bring it
              <br />
              home.
            </h2>
          </header>

          <div className={s.progress} aria-hidden="true">
            <span className={s.progressFill} />
            {steps.map((st) => (
              <span key={st.key} className={s.tick} style={{ "--i": st.index - 1 } as React.CSSProperties}>
                {String(st.index).padStart(2, "0")}
              </span>
            ))}
          </div>

          <ol className={s.track}>
            {steps.map((st) => {
              const attached = services.filter((sv) => sv.journeyStep === st.key);
              return (
                <li key={st.key} className={s.step} style={{ "--i": st.index - 1 } as React.CSSProperties}>
                  <div className={s.stepTop}>
                    <span className={s.stepNum}>{String(st.index).padStart(2, "0")}</span>
                    <span className="label">{st.duration}</span>
                  </div>
                  <h3 className={s.stepTitle}>{st.title}</h3>
                  <p className={s.summary}>{st.summary}</p>
                  <p className={s.detail}>{st.detail}</p>
                  {attached.length > 0 && (
                    <ul className={s.services}>
                      {attached.map((sv) => (
                        <li key={sv.key}>{sv.title}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
