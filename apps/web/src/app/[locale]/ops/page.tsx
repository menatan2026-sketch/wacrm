import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { admin } from "@mfg/core";
import { formatDateTime, formatMoney, formatPercent } from "@mfg/i18n";
import {
  DataTable,
  EmptyState,
  KpiTile,
  Ltr,
  ORDER_TONE,
  OnHoldIcon,
  SectionTitle,
  StatusChip,
} from "@mfg/ui";
import { resolveLocale } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

export default async function OpsDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { ctx } = await opsContext(locale, `/${locale}/ops`);
  const t = await getTranslations("admin.dashboard");
  const o = await getTranslations("orders");
  const r = await getTranslations("admin.reasons");
  const ol = await getTranslations("admin.orders");
  const od = await getTranslations("admin.order");
  const d = await admin.opsDashboard(ctx);
  const dash = (v: number | null, f: (n: number) => string) => (v === null ? "—" : f(v));
  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          label={t("revenueToday")}
          value={formatMoney(d.revenueTodayMinor, "ILS", locale)}
        />
        <KpiTile label={t("revenue30")} value={formatMoney(d.revenue30NetMinor, "ILS", locale)} />
        <KpiTile
          label={t("margin30")}
          value={dash(d.grossMargin30, (n) => formatPercent(n, locale))}
          tone={d.grossMargin30 !== null && d.grossMargin30 < 0.35 ? "warning" : undefined}
        />
        <KpiTile
          label={t("aov")}
          value={dash(d.aov30NetMinor, (n) => formatMoney(n, "ILS", locale))}
        />
        <KpiTile
          label={t("conversion")}
          value={dash(d.quoteToPurchase30, (n) => formatPercent(n, locale))}
        />
        <KpiTile
          label={t("lateJobs")}
          value={String(d.lateJobs)}
          tone={d.lateJobs > 0 ? "danger" : undefined}
        />
      </div>
      {d.stuckEvents > 0 && (
        <KpiTile label={t("stuckEvents")} value={String(d.stuckEvents)} tone="danger" />
      )}

      <section aria-labelledby="attention" className="flex flex-col gap-3">
        <SectionTitle id="attention">{t("attention")}</SectionTitle>
        <DataTable
          caption={t("attention")}
          rows={d.attention}
          rowKey={(a) => a.id}
          empty={
            <EmptyState
              icon={
                <CheckCircle2 aria-hidden className="size-10 text-success" strokeWidth={1.25} />
              }
              title={t("attentionEmpty")}
            />
          }
          columns={[
            {
              key: "order",
              header: ol("number"),
              cell: (a) => (
                <Link
                  href={`/${locale}/ops/orders/${a.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  <Ltr mono>{a.orderNumber}</Ltr>
                </Link>
              ),
            },
            {
              key: "status",
              header: ol("status"),
              cell: (a) => (
                <span className="flex items-center gap-2">
                  <StatusChip
                    tone={ORDER_TONE[a.status] ?? "neutral"}
                    label={o(`status.${a.status as "PAID"}`)}
                    size="sm"
                  />
                  {a.onHold && (
                    <OnHoldIcon aria-label={od("onHoldBadge")} className="size-4 text-warning" />
                  )}
                </span>
              ),
            },
            {
              key: "reason",
              header: t("reason"),
              cell: (a) =>
                [a.holdReason, ...(a.reviewReasons ?? [])]
                  .filter((x): x is string => Boolean(x))
                  .map((x) => (r.has(x) ? r(x) : x))
                  .join(" · ") || "—",
            },
            {
              key: "age",
              header: t("age"),
              cell: (a) => formatDateTime(a.statusChangedAt, locale),
            },
          ]}
        />
      </section>

      <section aria-labelledby="by-status" className="flex flex-col gap-3">
        <SectionTitle id="by-status">{t("byStatus")}</SectionTitle>
        <ul className="flex flex-wrap gap-2">
          {Object.entries(d.byStatus).map(([status, n]) => (
            <li key={status}>
              <Link
                href={`/${locale}/ops/orders?status=${status}`}
                className="flex items-center gap-2 rounded-s border border-border-subtle bg-surface-raised px-3 py-2 text-sm hover:border-border-strong"
              >
                {o(`status.${status as "PAID"}`)}{" "}
                <span className="font-semibold tabular-nums">{n}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
