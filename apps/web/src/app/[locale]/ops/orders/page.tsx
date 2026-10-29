import { Search } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { admin } from "@mfg/core";
import { ORDER_STATUSES } from "@mfg/db";
import { formatDateTime } from "@mfg/i18n";
import { Button, DataTable, EmptyState, Input, Ltr, ORDER_TONE, OnHoldIcon, Select, StatusChip } from "@mfg/ui";
import { useLocaleParam } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

export default async function OpsOrders({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; q?: string }> }) {
  const locale = await useLocaleParam(params);
  const { status, q } = await searchParams;
  const { ctx } = await opsContext(locale, `/${locale}/ops/orders`);
  const t = await getTranslations("admin.orders");
  const od = await getTranslations("admin.order");
  const o = await getTranslations("orders");
  const c = await getTranslations("common.actions");
  const validStatus = status && (ORDER_STATUSES as readonly string[]).includes(status) ? status : undefined;
  const rows = await admin.listOrdersAdmin(ctx, { status: validStatus, search: q?.trim().slice(0, 80) || undefined });
  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <form role="search" className="flex flex-wrap items-end gap-3" action={`/${locale}/ops/orders`}>
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-medium">
          {t("search")}
          <Input name="q" defaultValue={q ?? ""} dir="auto" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("status")}
          <Select name="status" defaultValue={validStatus ?? ""}>
            <option value="">{t("all")}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {o(`status.${s}`)}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary" icon={<Search aria-hidden className="size-4" />}>
          {c("search")}
        </Button>
      </form>
      <DataTable
        caption={t("title")}
        rows={rows}
        rowKey={(r) => r.order.id}
        empty={<EmptyState title={t("empty")} />}
        columns={[
          {
            key: "number",
            header: t("number"),
            cell: (r) => (
              <Link href={`/${locale}/ops/orders/${r.order.id}`} className="font-medium text-primary hover:underline">
                <Ltr mono>{r.order.orderNumber}</Ltr>
              </Link>
            ),
          },
          { key: "customer", header: t("customer"), cell: (r) => <Ltr>{r.email}</Ltr> },
          { key: "flow", header: od("flow"), cell: (r) => o(`flow.${r.order.flow as "file"}`) },
          {
            key: "status",
            header: t("status"),
            cell: (r) => (
              <span className="flex items-center gap-2">
                <StatusChip tone={ORDER_TONE[r.order.status] ?? "neutral"} label={o(`status.${r.order.status as "PAID"}`)} size="sm" />
                {r.order.onHold && <OnHoldIcon aria-label={od("onHoldBadge")} className="size-4 text-warning" />}
              </span>
            ),
          },
          { key: "created", header: t("created"), cell: (r) => formatDateTime(r.order.createdAt, locale) },
        ]}
      />
    </div>
  );
}
