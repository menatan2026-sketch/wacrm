import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { payments } from "@mfg/core";
import { formatDateTime, formatMoney } from "@mfg/i18n";
import { DataTable, EmptyState } from "@mfg/ui";
import { approveRefundAction } from "@/app/actions/ops";
import { ActionForm } from "@/components/ActionForm";
import { useLocaleParam } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

export default async function OpsPayments({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await useLocaleParam(params);
  const { actor, ctx } = await opsContext(locale, `/${locale}/ops/payments`);
  const t = await getTranslations("admin.payments");
  const od = await getTranslations("admin.order");
  const rows = await payments.pendingRefunds(ctx);
  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-text-secondary">{t("pending")}</p>
      <DataTable
        caption={t("pending")}
        rows={rows}
        rowKey={(r) => r.refund.id}
        empty={<EmptyState title={t("none")} />}
        columns={[
          { key: "order", header: od("refund"), cell: (r) => <Link href={`/${locale}/ops/orders/${r.orderId}`} className="text-primary hover:underline">{t("openOrder")}</Link> },
          { key: "amount", header: od("refundAmount"), numeric: true, cell: (r) => formatMoney(r.refund.amountMinor, "ILS", locale) },
          { key: "reason", header: od("refundReason"), cell: (r) => (od.has(`refundReasons.${r.refund.reasonCode}`) ? od(`refundReasons.${r.refund.reasonCode as "other"}`) : r.refund.reasonCode) },
          { key: "note", header: od("internalNote"), cell: (r) => r.refund.note ?? "—" },
          { key: "at", header: t("requested"), cell: (r) => formatDateTime(r.refund.createdAt, locale) },
          {
            key: "act",
            header: "",
            cell: (r) => (r.refund.requestedBy === actor.userId ? <span className="text-xs text-text-secondary">{t("secondPerson")}</span> : <ActionForm action={approveRefundAction.bind(null, locale, r.refund.id)} submitLabel={t("approve")} size="sm" dialogTitle={t("approve")} />),
          },
        ]}
      />
    </div>
  );
}
