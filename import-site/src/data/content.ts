import type { JourneyStep, Service, Testimonial, VerificationKey } from "@/domain/types";

export const journey: JourneyStep[] = [
  {
    index: 1,
    key: "discover",
    title: "Discover",
    summary: "We start from the car in your head.",
    detail: "Make, model, spec, colour, budget, timing. A specialist turns it into a sourcing brief and a realistic landed-cost range before anything else happens.",
    duration: "Day 1",
  },
  {
    index: 2,
    key: "source",
    title: "Source",
    summary: "Seven markets, searched in parallel.",
    detail: "Dealer networks, factory retailers, auctions and private sellers across Europe, the US, the Gulf and Asia. You get a shortlist, not a feed.",
    duration: "1–3 weeks",
  },
  {
    index: 3,
    key: "verify",
    title: "Verify",
    summary: "Every claim, checked against a document.",
    detail: "History, mileage, ownership, accident record, service book, build sheet and an independent inspection. You see what's verified and what isn't.",
    duration: "3–7 days",
  },
  {
    index: 4,
    key: "purchase",
    title: "Purchase",
    summary: "Negotiated, contracted and paid safely.",
    detail: "We negotiate price and terms, check the seller and the paperwork, and handle staged payments through controlled accounts.",
    duration: "2–5 days",
  },
  {
    index: 5,
    key: "transport",
    title: "Transport",
    summary: "Collected, insured and shipped.",
    detail: "Enclosed collection to the port, full transit insurance, then RoRo or a dedicated container to Haifa or Ashdod. Tracked end to end.",
    duration: "10–55 days",
  },
  {
    index: 6,
    key: "customs",
    title: "Customs",
    summary: "Cleared, with no surprises.",
    detail: "Customs valuation, duty, purchase tax and VAT handled by licensed brokers — reconciled against the estimate you signed off on.",
    duration: "3–10 days",
  },
  {
    index: 7,
    key: "register",
    title: "Register",
    summary: "Tested, approved and plated.",
    detail: "Standards testing, individual approval, roadworthiness test and first licence. Israeli plates on your car.",
    duration: "5–15 days",
  },
  {
    index: 8,
    key: "deliver",
    title: "Deliver",
    summary: "To your driveway.",
    detail: "Detailed, enclosed-transported and handed over at your door with every document, key and accessory accounted for.",
    duration: "Your day",
  },
];

export const services: Service[] = [
  { key: "sourcing", title: "Personal vehicle sourcing", summary: "A dedicated specialist who owns your brief from the first call to handover.", journeyStep: "discover" },
  { key: "search", title: "International vehicle search", summary: "Dealers, factory retailers, auctions and private sellers in seven markets.", journeyStep: "source" },
  { key: "inspection", title: "Pre-purchase inspection", summary: "Independent, on-site inspection with a photographed report before you commit.", journeyStep: "verify" },
  { key: "negotiation", title: "Negotiation", summary: "Local-language negotiation on price, terms and included extras.", journeyStep: "purchase" },
  { key: "logistics", title: "Logistics", summary: "Enclosed collection, storage and export paperwork in the origin country.", journeyStep: "transport" },
  { key: "shipping", title: "Shipping", summary: "RoRo, shared or dedicated container — insured and tracked.", journeyStep: "transport" },
  { key: "customs", title: "Customs & tax handling", summary: "Licensed brokers, transparent valuation and reconciled taxes.", journeyStep: "customs" },
  { key: "registration", title: "Registration support", summary: "Testing, approvals, licensing and plates, handled for you.", journeyStep: "register" },
  { key: "delivery", title: "Door-to-door delivery", summary: "Enclosed delivery and a proper handover, wherever you are in Israel.", journeyStep: "deliver" },
];

export const verificationLabels: Record<VerificationKey, { title: string; description: string; source: string }> = {
  history: { title: "Vehicle history", description: "Registration, title and event history pulled against the VIN.", source: "History report" },
  mileage: { title: "Mileage verification", description: "Odometer compared with service, inspection and auction records over time.", source: "Records timeline" },
  ownership: { title: "Ownership", description: "Number of keepers and the chain of title back to first registration.", source: "Registration documents" },
  accidents: { title: "Accident history", description: "Insurance claims, repair records and paint-depth readings on every panel.", source: "Claims data + paint gauge" },
  service: { title: "Service records", description: "Stamps matched to invoices and dealer systems — not just a stamped book.", source: "Dealer systems" },
  mechanical: { title: "Mechanical inspection", description: "Independent on-site inspection: drivetrain, brakes, electronics, road test.", source: "Inspection report" },
  specification: { title: "Specification", description: "Factory options decoded from the build sheet, not from the advert.", source: "Factory build data" },
  documentation: { title: "Documentation", description: "Title, certificate of conformity, export and import paperwork.", source: "Originals" },
};

/**
 * Social proof. These entries are LAYOUT SAMPLES — they render with an
 * "Illustrative" tag and carry no quotes. Replace them with real,
 * client-approved stories (and set `isSample: false`) before launch.
 */
export const testimonials: Testimonial[] = [
  {
    id: "t-001",
    customer: "Private client",
    vehicle: "2024 Mercedes-AMG GT 63 S",
    origin: { countryCode: "DE", city: "Stuttgart", lat: 48.78, lng: 9.18 },
    destination: "Tel Aviv",
    isSample: true,
  },
  {
    id: "t-002",
    customer: "Private client",
    vehicle: "2025 Lamborghini Urus SE",
    origin: { countryCode: "AE", city: "Dubai", lat: 25.2, lng: 55.27 },
    destination: "Herzliya",
    isSample: true,
  },
  {
    id: "t-003",
    customer: "Private client",
    vehicle: "2025 Ford F-150 Raptor R",
    origin: { countryCode: "US", city: "Dallas", lat: 32.78, lng: -96.8 },
    destination: "Caesarea",
    isSample: true,
  },
];
