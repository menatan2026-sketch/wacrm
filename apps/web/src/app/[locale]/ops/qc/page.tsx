import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { production } from "@mfg/core";
import { formatDateTime } from "@mfg/i18n";
import { DataTable, EmptyState, JOB_TONE, Ltr, StatusChip } from "@mfg/ui";
import { resolveLocale } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

export default async function QcQueue({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { ctx } = await opsContext(locale, `/${locale}/ops/qc`);
  const t = await getTranslations("admin.qc");
  const ol = await getTranslations("admin.orders");
  const j = await getTranslations("supplier.job");
  const rows = await production.qcQueue(ctx);
  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <DataTable
        caption={t("title")}
        rows={rows}
        rowKey={(r) => r.job.id}
        empty={
          <EmptyState
            icon={<CheckCircle2 aria-hidden className="size-10 text-success" strokeWidth={1.25} />}
            title={t("empty")}
          />
        }
        columns={[
          { key: "order", header: ol("number"), cell: (r) => <Ltr mono>{r.orderNumber}</Ltr> },
          { key: "supplier", header: t("supplier"), cell: (r) => r.supplierName ?? "—" },
          {
            key: "status",
            header: ol("status"),
            cell: (r) => (
              <StatusChip
                tone={JOB_TONE[r.job.status] ?? "neutral"}
                label={j(`status.${r.job.status as "QC_PENDING"}`)}
                size="sm"
              />
            ),
          },
          { key: "attempt", header: t("attemptCol"), numeric: true, cell: (r) => r.job.attemptNo },
          {
            key: "produced",
            header: t("submitted"),
            cell: (r) => (r.job.producedAt ? formatDateTime(r.job.producedAt, locale) : "—"),
          },
          {
            key: "act",
            header: "",
            cell: (r) => (
              <Link
                href={`/${locale}/ops/qc/${r.job.id}`}
                className="font-medium text-primary hover:underline"
              >
                {t("review")}
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
