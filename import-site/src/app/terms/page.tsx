import type { Metadata } from "next";
import { LegalPage } from "@/components/page/LegalPage";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage
      index="Legal"
      title={["Terms of use"]}
      updated="September 2026"
      intro={`The terms that apply when you use ${site.name}'s website.`}
      sections={[
        { heading: "Listings and estimates", body: ["Vehicle listings describe vehicles we have located or can source to order. Availability can change without notice.", "All landed prices and calculator results are estimates based on assumptions that change over time. They are not offers or quotes. Final costs depend on customs valuation, applicable taxes, regulations, exchange rates and the specific vehicle."] },
        { heading: "Verification labels", body: ["Information marked “Verified” has been checked against a document or inspection we commissioned. “Reported” information comes from the seller and has not yet been independently confirmed. “Estimate” figures are calculated."] },
        { heading: "Engagements", body: ["A sourcing or import engagement begins only once we have both signed a written agreement setting out scope, fees and responsibilities."] },
        { heading: "Imagery", body: ["Where a listing has no photography yet, a studio illustration is shown. It indicates body style and colour only."] },
      ]}
    />
  );
}
