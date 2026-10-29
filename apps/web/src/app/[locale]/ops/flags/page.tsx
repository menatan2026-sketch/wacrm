import { getTranslations } from "next-intl/server";
import { flags } from "@mfg/core";
import { formatDateTime } from "@mfg/i18n";
import { Badge, Banner, Card, Ltr } from "@mfg/ui";
import { setFlagAction } from "@/app/actions/ops";
import { ActionForm } from "@/components/ActionForm";
import { useLocaleParam } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

export default async function OpsFlags({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await useLocaleParam(params);
  const { ctx } = await opsContext(locale, `/${locale}/ops/flags`);
  const t = await getTranslations("admin.flags");
  const od = await getTranslations("admin.order");
  const rows = await flags.listFlags(ctx);
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Banner tone="info">{t("intro")}</Banner>
      <ul className="flex flex-col gap-3">
        {rows.map((f) => (
          <li key={f.key}>
            <Card className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-medium">
                  <Ltr mono>{f.key}</Ltr>
                  <Badge tone={f.enabled ? "success" : "neutral"}>{f.enabled ? t("on") : t("off")}</Badge>
                </span>
                <span className="text-sm text-text-secondary">{t.has(`describe.${f.key}`) ? t(`describe.${f.key as "AUTO_PRICING"}`) : f.description}</span>
                <span className="text-xs text-text-tertiary">{formatDateTime(f.updatedAt, locale)}</span>
              </div>
              <ActionForm
                action={setFlagAction.bind(null, locale, f.key, !f.enabled)}
                submitLabel={f.enabled ? t("turnOff") : t("turnOn")}
                variant={f.enabled ? "secondary" : "primary"}
                size="sm"
                dialogTitle={`${f.key}: ${f.enabled ? t("turnOff") : t("turnOn")}`}
                fields={[{ name: "reason", label: od("reason"), kind: "textarea", required: true }]}
              />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
