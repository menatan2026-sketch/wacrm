import type { Metadata } from "next";
import { LegalPage } from "@/components/page/LegalPage";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage
      index="Legal"
      title={["Privacy policy"]}
      updated="September 2026"
      intro={`How ${site.legalName} collects, uses and protects the details you share with us.`}
      sections={[
        { heading: "What we collect", body: ["When you send a request we collect your name, phone number, optional email address, your preferred contact channel and the details of the vehicle you are looking for.", "We collect basic, aggregated analytics about how the site is used. We do not sell personal data."] },
        { heading: "How we use it", body: ["To contact you about your request, prepare sourcing briefs and cost estimates, and manage the import if you choose to proceed.", "Your request is stored in our customer-relationship system and may be shared with partners strictly needed to carry out your import — inspectors, shippers, customs brokers."] },
        { heading: "Retention and your rights", body: ["We keep request data for as long as needed to handle your enquiry and meet legal obligations. You may ask to access, correct or delete your data at any time."] },
        { heading: "Contact", body: [`Privacy questions: ${site.contact.email}.`] },
      ]}
    />
  );
}
