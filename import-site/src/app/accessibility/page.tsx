import type { Metadata } from "next";
import { LegalPage } from "@/components/page/LegalPage";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Accessibility" };

export default function Accessibility() {
  return (
    <LegalPage
      index="Accessibility statement"
      title={["Accessibility"]}
      updated="September 2026"
      intro="We want everyone to be able to find and import the car they want."
      sections={[
        { heading: "Our approach", body: ["This site is designed to meet the Web Content Accessibility Guidelines (WCAG) 2.1 level AA and Israeli Standard 5568.", "All content in the 3D story is also available as text. Every interactive 3D element has an equivalent control, and motion-heavy effects are reduced when your system asks for reduced motion."] },
        { heading: "Keyboard and assistive technology", body: ["All navigation, forms, filters and the calculator can be used with a keyboard. Forms announce errors to screen readers."] },
        { heading: "Known limitations", body: ["The 3D vehicle viewer is a visual experience; the specifications it shows are always listed as text on the same page."] },
        { heading: "Contact our accessibility coordinator", body: [`If anything on this site is difficult to use, please tell us: ${site.contact.email} · ${site.contact.phone}.`] },
      ]}
    />
  );
}
