import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DomainError, production } from "@mfg/core";
import { formatDateTime } from "@mfg/i18n";
import { Badge, Banner, buttonClasses, Card, JOB_TONE, Ltr, SectionTitle, StatusChip } from "@mfg/ui";
import { useLocaleParam } from "@/lib/i18n";
import { partnerContext } from "@/lib/partner";
import { PartSpec } from "../../_components/PartSpec";
import { JobClient } from "./JobClient";

export default async function JobPage({ params }: { params: Promise<{ locale: string; jobId: string }> }) {
  const locale = await useLocaleParam(params);
  const { jobId } = await params;
  const { ctx } = await partnerContext(locale, `/${locale}/partners/jobs/${jobId}`);
  const t = await getTranslations("supplier.job");
  const card = await production.jobCard(ctx, jobId).catch((e) => {
    if (e instanceof DomainError) notFound();
    throw e;
  });
  const { job, order, items, inspections, qc } = card;
  const first = items[0];
  const part = {
    quantity: items.reduce((s, i) => s + i.item.quantity, 0),
    materialCode: first?.material?.code ?? null,
    materialI18n: first?.material?.i18n ?? null,
    colorI18n: first?.variant?.i18n ?? null,
    colorHex: first?.variant?.colorHex ?? null,
    sizeMm: qc.measurements.length === 3 ? (qc.measurements.map((m) => m.expectedMm) as [number, number, number]) : null,
  };
  const fileAvailable = ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "QC_FAILED"].includes(job.status) && first?.item.fileId;
  const lastReview = inspections.find((i) => i.stage === "platform_review");
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-8 md:px-8">
      <Link href={`/${locale}/partners`} className="inline-flex w-fit items-center gap-2 text-sm text-primary hover:underline">
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <Ltr mono>{order.orderNumber}</Ltr>
          {job.attemptNo > 1 && <Badge tone="warning">{t("attempt", { n: job.attemptNo })}</Badge>}
        </h1>
        <StatusChip tone={JOB_TONE[job.status] ?? "neutral"} label={t(`status.${job.status as "ACCEPTED"}`)} />
      </div>
      <Card className="flex flex-col gap-4">
        <PartSpec part={part} locale={locale} />
        {job.dueAt && <p className="text-sm font-medium">{t("dueBy", { date: formatDateTime(job.dueAt, locale) })}</p>}
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          <SectionTitle>{t("file")}</SectionTitle>
          {fileAvailable ? (
            <a href={`/api/files/${first!.item.fileId}?purpose=production`} className={buttonClasses("secondary", "md", "w-fit")}>
              <Download aria-hidden className="size-4" />
              {t("download")}
            </a>
          ) : (
            <p className="text-sm text-text-secondary">{t("noFile")}</p>
          )}
        </div>
      </Card>
      {job.status === "QC_PENDING" && <Banner tone="info">{t("waiting")}</Banner>}
      {job.status === "QC_PASSED" && <Banner tone="success">{t("passed")}</Banner>}
      {job.status === "QC_FAILED" && (
        <Banner tone="danger">
          {t("failed")}
          {lastReview?.notes ? <span className="mt-1 block text-text-secondary">{lastReview.notes}</span> : null}
        </Banner>
      )}
      {(job.status === "ACCEPTED" || job.status === "IN_PRODUCTION") && (
        <JobClient
          locale={locale}
          jobId={job.id}
          status={job.status}
          measurements={qc.measurements.map((m) => ({ name: m.name, expectedMm: m.expectedMm, toleranceMm: m.toleranceMm }))}
          checklist={[...qc.checklist]}
        />
      )}
    </div>
  );
}
