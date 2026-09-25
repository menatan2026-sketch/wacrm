import { ImportCalculator } from "@/components/calculator/ImportCalculator";
import { RevealText } from "@/components/ui/RevealText";
import c from "./chapter.module.css";

/** The numbers, before anyone asks: an interactive landed-cost estimate. */
export function CalculatorSection() {
  return (
    <section className={`${c.plate} ${c.sectionPad}`} aria-labelledby="calc-title">
      <div className="container">
        <div className={c.sectionHead}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <p className={c.index}>Import cost</p>
            <RevealText id="calc-title" className="display-m" lines={["Know the price", "before you start."]} />
          </div>
          <p className="body-l">Every tax and fee to your door, line by line. Your specialist confirms it in writing.</p>
        </div>
        <ImportCalculator variant="compact" />
      </div>
    </section>
  );
}
