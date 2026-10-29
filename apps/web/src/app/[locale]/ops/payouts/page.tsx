import { getTranslations } from "next-intl/server";
import { admin } from "@mfg/core";
import { formatDate, formatMoney } from "@mfg/i18n";
import { Badge, Card, DataTable, EmptyState, SectionTitle } from "@mfg/ui";
import { closeStatementAction, markPaidAction } from "@/app/actions/ops";
import { ActionForm } from "@/components/ActionForm";
import { resolveLocale } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

export default async function OpsPayouts({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { ctx } = await opsContext(locale, `/${locale}/ops/payouts`);
  const t = await getTranslations("admin.payouts");
  const s = await getTranslations("admin.suppliers");
  const { suppliers, openStatements } = await admin.payoutOverview(ctx);
  const name = (id: string) => suppliers.find((x) => x.id === id)?.name ?? "—";
  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <DataTable
        caption={t("title")}
        rows={suppliers}
        rowKey={(r) => r.id}
        empty={<EmptyState title={s("empty")} />}
        columns={[
          {
            key: "name",
            header: s("name"),
            cell: (r) => <span className="font-medium">{r.name}</span>,
          },
          {
            key: "pending",
            header: t("pending"),
            numeric: true,
            cell: (r) => formatMoney(r.unstatementedMinor, "ILS", locale),
          },
          {
            key: "balance",
            header: t("balance"),
            numeric: true,
            cell: (r) => formatMoney(r.balanceMinor, "ILS", locale),
          },
          {
            key: "details",
            header: t("details"),
            cell: (r) =>
              r.hasDetails ? (
                <Badge tone="success">✓</Badge>
              ) : (
                <Badge tone="warning">{t("noDetails")}</Badge>
              ),
          },
          {
            key: "act",
            header: "",
            cell: (r) =>
              r.unstatementedMinor !== 0 ? (
                <ActionForm
                  action={closeStatementAction.bind(null, locale, r.id)}
                  submitLabel={t("close")}
                  variant="secondary"
                  size="sm"
                  dialogTitle={t("close")}
                />
              ) : null,
          },
        ]}
      />
      <Card className="flex flex-col gap-4">
        <SectionTitle>{t("open")}</SectionTitle>
        {openStatements.length === 0 ? (
          <p className="text-sm text-text-secondary">{t("noOpen")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {openStatements.map((st) => (
              <li key={st.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-sm">
                  <span className="font-medium">{name(st.supplierId)}</span> ·{" "}
                  {formatDate(st.periodStart, locale)} – {formatDate(st.periodEnd, locale)} ·{" "}
                  <span className="tabular-nums">
                    {formatMoney(st.totalMinor, st.currency, locale)}
                  </span>
                </span>
                <ActionForm
                  action={markPaidAction.bind(null, locale, st.id)}
                  submitLabel={t("markPaid")}
                  size="sm"
                  dialogTitle={t("markPaid")}
                  dialogDescription={t("holdHint")}
                  fields={[
                    {
                      name: "reference",
                      label: t("reference"),
                      kind: "text",
                      required: true,
                      ltr: true,
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
