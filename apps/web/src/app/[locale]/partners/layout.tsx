import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SurfaceShell } from "@/components/SurfaceShell";
import { useLocaleParam } from "@/lib/i18n";
import { getActor } from "@/lib/session";

export default async function PartnerLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await useLocaleParam(params);
  const t = await getTranslations("navigation.supplier");
  const actor = await getActor("supplier");
  const base = `/${locale}/partners`;
  const nav = [
    { href: base, label: t("today") },
    { href: `${base}/payouts`, label: t("payouts") },
    { href: `${base}/profile`, label: t("profile") },
  ];
  return (
    <SurfaceShell surface="supplier" locale={locale} title={t("title")} base={base} nav={nav} navLabel={t("title")} userEmail={actor?.email}>
      {children}
    </SurfaceShell>
  );
}
