/**
 * Brand + navigation config. Everything a rebrand touches lives here.
 */
export const site = {
  name: "Portolan",
  legalName: "Portolan Private Import Ltd.",
  tagline: "Private vehicle sourcing & import",
  description:
    "Personal vehicle sourcing and import to Israel — built around the exact car you want. Luxury, performance, electric and rare specifications from Germany, Italy, the UK, the USA, the UAE and Japan.",
  url: "https://portolan.example",
  locale: "en_IL",
  contact: {
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "972500000000",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "import@portolan.example",
    phone: process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "+972 3 000 0000",
    address: "Tel Aviv, Israel",
    hours: "Sun–Thu · 09:00–19:00",
  },
  social: {
    instagram: "https://instagram.com/",
  },
} as const;

export interface NavItem {
  label: string;
  href: string;
}

export const primaryNav: NavItem[] = [
  { label: "Vehicles", href: "/vehicles" },
  { label: "Import", href: "/import" },
  { label: "How it works", href: "/#journey" },
  { label: "Services", href: "/#services" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/request" },
];

export const footerNav: NavItem[] = [
  { label: "Vehicles", href: "/vehicles" },
  { label: "Import", href: "/import" },
  { label: "Services", href: "/#services" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/request" },
];

export const legalNav: NavItem[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Accessibility", href: "/accessibility" },
];

export function whatsappHref(message?: string) {
  const base = `https://wa.me/${site.contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
