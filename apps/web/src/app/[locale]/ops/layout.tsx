import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { rbac } from "@mfg/core";
import { SurfaceShell } from "@/components/SurfaceShell";
import { useLocaleParam } from "@/lib/i18n";
import { getActor } from "@/lib/session";

const SECTIONS = [
  { path: "", key: "dashboard", permission: "staff.access" },
  { path: "/orders", key: "orders", permission: "order.read.any" },
  { path: "/qc", key: "qc", permission: "qc.verdict" },
  { path: "/suppliers", key: "suppliers", permission: "supplier.manage" },
  { path: "/pricing", key: "pricing", permission: "pricing.rules.manage" },
  { path: "/payments", key: "payments", permission: "payment.read.any" },
  { path: "/payouts", key: "payouts", permission: "payout.manage" },
  { path: "/flags", key: "flags", permission: "flags.manage" },
  { path: "/audit", key: "audit", permission: "audit.read" },
] as const;

export default async function OpsLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await useLocaleParam(params);
  const t = await getTranslations("navigation.admin");
  const actor = await getActor("admin");
  const base = `/${locale}/ops`;
  // Nav reflects permissions for convenience only; every page and action re-checks on the server.
  const nav = actor?.mfaVerified ? SECTIONS.filter((s) => rbac.can(actor, s.permission)).map((s) => ({ href: `${base}${s.path}`, label: t(s.key) })) : [];
  return (
    <SurfaceShell surface="admin" locale={locale} title={t("title")} base={base} nav={nav} navLabel={t("title")} userEmail={actor?.email}>
      {children}
    </SurfaceShell>
  );
}
