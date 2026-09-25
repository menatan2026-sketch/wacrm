import type { Metadata } from "next";
import { ImportCalculator } from "@/components/calculator/ImportCalculator";
import { PageHeader } from "@/components/page/PageHeader";
import { importRules } from "@/config/import-rules";
import s from "./page.module.css";

export const metadata: Metadata = {
  title: "Personal import calculator",
  description: "Estimate the landed cost of importing a vehicle to Israel — freight, insurance, customs, purchase tax, VAT, testing and registration.",
};

export default function ImportPage() {
  const r = importRules;
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  return (
    <div className={s.page}>
      <PageHeader
        index="Personal import calculator"
        title={["What will it cost", "to land?"]}
        lede="Enter the purchase price and a few details. We'll estimate the landed cost in Israel, line by line — an estimate to plan with, not a quote."
      />
      <div className="container">
        <ImportCalculator variant="full" />

        <section className={s.assumptions} aria-labelledby="assumptions">
          <h2 id="assumptions" className="display-s">
            Assumptions
          </h2>
          <p className="body-l">
            Rates below are planning assumptions ({r.rulesVersion}). They change, and some depend on the specific vehicle. We
            confirm every figure with a licensed customs broker before you commit to a purchase.
          </p>
          <dl className={s.table}>
            <div>
              <dt>VAT</dt>
              <dd>{pct(r.vatRate)}</dd>
            </div>
            <div>
              <dt>Customs duty (non-agreement origins)</dt>
              <dd>{pct(r.customsDutyRate)}</dd>
            </div>
            <div>
              <dt>Purchase tax — petrol / diesel / hybrid</dt>
              <dd>{pct(r.purchaseTaxRate.petrol)}</dd>
            </div>
            <div>
              <dt>Purchase tax — plug-in hybrid</dt>
              <dd>{pct(r.purchaseTaxRate["plug-in-hybrid"])}</dd>
            </div>
            <div>
              <dt>Purchase tax — electric</dt>
              <dd>{pct(r.purchaseTaxRate.electric)}</dd>
            </div>
            <div>
              <dt>Luxury tax</dt>
              <dd>
                {pct(r.luxuryTax.rate)} above ₪{r.luxuryTax.thresholdILS.toLocaleString("en-US")}
              </dd>
            </div>
            <div>
              <dt>Transit insurance</dt>
              <dd>{pct(r.insuranceRate)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
