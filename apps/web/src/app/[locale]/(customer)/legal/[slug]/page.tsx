import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Banner } from "@mfg/ui";
import { resolveLocale } from "@/lib/i18n";

const SLUGS = ["terms", "privacy", "accessibility", "restricted", "shipping"] as const;

/**
 * Policy pages: scaffolds clearly marked as drafts until legal provides content (KNOWN_ISSUES KI-005).
 * Rendered per request like every page: the nonce-based CSP requires dynamic rendering.
 */
export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  await resolveLocale(params);
  const { slug } = await params;
  if (!SLUGS.includes(slug as (typeof SLUGS)[number])) notFound();
  const t = await getTranslations("common");
  return (
    <article className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold">{t(`footer.${slug as "terms"}`)}</h1>
      <Banner tone="warning">{t("draftNotice")}</Banner>
    </article>
  );
}
