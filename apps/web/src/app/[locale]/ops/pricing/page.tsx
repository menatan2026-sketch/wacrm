import { getTranslations } from "next-intl/server";
import { pricingAdmin, pricingRules } from "@mfg/core";
import { formatDateTime } from "@mfg/i18n";
import { Badge, Banner, Card, SectionTitle } from "@mfg/ui";
import { activateRuleAction, ruleDraftAction } from "@/app/actions/ops";
import { ActionForm } from "@/components/ActionForm";
import { useLocaleParam } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

export default async function OpsPricing({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await useLocaleParam(params);
  const { actor, ctx } = await opsContext(locale, `/${locale}/ops/pricing`);
  const t = await getTranslations("admin.pricing");
  const od = await getTranslations("admin.order");
  const sets = await pricingAdmin.listRuleSets(ctx);
  const active = sets.find((s) => s.status === "active");
  const base = JSON.stringify(active?.rules ?? pricingRules.DEFAULT_FDM_RULES, null, 2);
  return (
    <div className="mx-auto grid max-w-[1320px] gap-6 px-4 py-8 md:px-8 xl:grid-cols-[1fr_420px]">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Banner tone="info">{t("intro")}</Banner>
        <Card className="flex flex-col gap-4">
          <SectionTitle>{t("newDraft")}</SectionTitle>
          <ActionForm action={ruleDraftAction.bind(null, locale)} submitLabel={t("newDraft")} fields={[{ name: "rules", label: t("rules"), kind: "textarea", ltr: true, required: true, defaultValue: base }]} />
        </Card>
      </div>
      <aside className="flex flex-col gap-3">
        {sets.map((s) => (
          <Card key={s.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{t("version", { n: s.version })}</span>
              <Badge tone={s.status === "active" ? "success" : s.status === "draft" ? "warning" : "neutral"}>{t(`status.${s.status as "draft"}`)}</Badge>
            </div>
            <span className="text-sm text-text-secondary">{formatDateTime(s.activatedAt ?? s.createdAt, locale)}</span>
            {s.status === "draft" && s.createdBy !== actor.userId && (
              <ActionForm action={activateRuleAction.bind(null, locale, s.id)} submitLabel={t("activate")} size="sm" dialogTitle={t("activate")} fields={[{ name: "reason", label: od("reason"), kind: "textarea", required: true }]} />
            )}
            {s.status === "draft" && s.createdBy === actor.userId && <p className="text-xs text-text-secondary">{t("secondPerson")}</p>}
          </Card>
        ))}
      </aside>
    </div>
  );
}
