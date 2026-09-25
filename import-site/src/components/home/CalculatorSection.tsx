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
            <p className={c.index}>Calculate import cost</p>
            <RevealText id="calc-title" className="display-m" lines={["What will it cost", "to land?"]} />
          </div>
          <p className="body-l">
            Purchase price in, estimated landed cost out — freight, insurance, duty, purchase tax, VAT, testing and registration,
            line by line. An estimate to plan with, never a promise.
          </p>
        </div>
        <ImportCalculator variant="compact" />
      </div>
    </section>
  );
}
