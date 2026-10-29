import { getTranslations } from "next-intl/server";
import { suppliers } from "@mfg/core";
import { formatPercent } from "@mfg/i18n";
import { Badge, Card, DataTable, EmptyState, Ltr, SectionTitle, type Tone } from "@mfg/ui";
import { inviteSupplierAction, supplierStatusAction } from "@/app/actions/ops";
import { ActionForm } from "@/components/ActionForm";
import { useLocaleParam } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

const STATUS_TONE: Record<string, Tone> = { invited: "neutral", onboarding: "info", active: "success", paused: "warning", suspended: "danger" };

export default async function OpsSuppliers({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await useLocaleParam(params);
  const { ctx } = await opsContext(locale, `/${locale}/ops/suppliers`);
  const t = await getTranslations("admin.suppliers");
  const od = await getTranslations("admin.order");
  const p = await getTranslations("supplier.profile.items");
  const rows = await suppliers.listSuppliers(ctx);
  const reasonField = { name: "reason", label: od("reason"), kind: "textarea" as const, required: true };
  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Card className="flex flex-col gap-4">
        <SectionTitle>{t("invite")}</SectionTitle>
        <ActionForm
          action={inviteSupplierAction.bind(null, locale)}
          submitLabel={t("send")}
          fields={[
            { name: "name", label: t("name"), kind: "text", required: true },
            { name: "email", label: t("email"), kind: "text", required: true, ltr: true },
            { name: "locale", label: t("language"), kind: "select", options: [{ value: "he", label: "עברית" }, { value: "en", label: "English" }, { value: "ru", label: "Русский" }], defaultValue: locale },
          ]}
          successMessage={t("inviteSent")}
          resultField="inviteLink"
        />
      </Card>
      <DataTable
        caption={t("title")}
        rows={rows}
        rowKey={(s) => s.id}
        empty={<EmptyState title={t("empty")} />}
        columns={[
          { key: "name", header: t("name"), cell: (s) => <span className="font-medium">{s.name}</span> },
          { key: "email", header: t("email"), cell: (s) => <Ltr>{s.contactEmail ?? "—"}</Ltr> },
          { key: "status", header: t("statusCol"), cell: (s) => <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{t(`status.${s.status as "active"}`)}</Badge> },
          {
            key: "checklist",
            header: t("checklist"),
            cell: (s) => {
              const missing = Object.entries(s.onboarding).filter(([, v]) => !v).map(([k]) => p(k as "company"));
              return missing.length ? <span className="text-text-secondary">{missing.join(", ")}</span> : <Badge tone="success">✓</Badge>;
            },
          },
          { key: "quality", header: t("quality"), numeric: true, cell: (s) => (s.stats?.qualityScore !== undefined ? formatPercent(s.stats.qualityScore, locale) : "—") },
          { key: "ontime", header: t("onTime"), numeric: true, cell: (s) => (s.stats?.onTimeRate !== undefined ? formatPercent(s.stats.onTimeRate, locale) : "—") },
          {
            key: "act",
            header: "",
            cell: (s) =>
              s.status === "active" ? (
                <ActionForm action={supplierStatusAction.bind(null, locale, s.id, "paused")} submitLabel={t("pause")} variant="secondary" size="sm" dialogTitle={t("pause")} fields={[reasonField]} />
              ) : s.status !== "invited" ? (
                <ActionForm action={supplierStatusAction.bind(null, locale, s.id, "active")} submitLabel={t("activate")} size="sm" dialogTitle={t("activate")} fields={[reasonField]} />
              ) : null,
          },
        ]}
      />
    </div>
  );
}
