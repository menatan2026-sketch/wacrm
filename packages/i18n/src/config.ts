export const locales = ["he", "en", "ru"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "he";

export const NAMESPACES = [
  "common",
  "navigation",
  "auth",
  "customer",
  "orders",
  "quotes",
  "supplier",
  "admin",
  "payments",
  "shipping",
  "errors",
  "validation",
  "notifications",
  "manufacturing",
  "materials",
  "qc",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const isLocale = (value: unknown): value is AppLocale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

export const directionOf = (locale: AppLocale): "rtl" | "ltr" => (locale === "he" ? "rtl" : "ltr");

/** Language names shown in the switcher, each in its own language. */
export const LOCALE_NAMES: Record<AppLocale, string> = {
  he: "עברית",
  en: "English",
  ru: "Русский",
};

/** Pick the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): AppLocale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0] === "iw" ? "he" : tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
