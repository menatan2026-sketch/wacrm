import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DomainError, production } from "@mfg/core";
import { formatNumber } from "@mfg/i18n";
import { Badge, Banner, Card, JOB_TONE, Ltr, SectionTitle, StatusChip } from "@mfg/ui";
import { qcVerdictAction, reprintAction } from "@/app/actions/ops";
import { ActionForm } from "@/components/ActionForm";
import { catalogName, resolveLocale } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

export default async function QcReview({
  params,
}: {
  params: Promise<{ locale: string; jobId: string }>;
}) {
  const locale = await resolveLocale(params);
  const { jobId } = await params;
  const { ctx } = await opsContext(locale, `/${locale}/ops/qc/${jobId}`);
  const t = await getTranslations("admin.qc");
  const q = await getTranslations("qc");
  const j = await getTranslations("supplier.job");
  const card = await production.jobCard(ctx, jobId).catch((e) => {
    if (e instanceof DomainError) notFound();
    throw e;
  });
  const { job, order, items, inspections } = card;
  const evidence = inspections.find((i) => i.stage === "supplier_evidence");
  const reviews = inspections.filter((i) => i.stage === "platform_review");
  const defectOptions = production.DEFECT_CODES.map((c) => ({
    value: c,
    label: q(`defects.${c}`),
  }));
  const notes = { name: "notes", label: j("notes"), kind: "textarea" as const };
  const first = items[0];
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8 md:px-8">
      <Link href={`/${locale}/ops/qc`} className="w-fit text-sm text-primary hover:underline">
        {t("title")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">
          <Ltr mono>{order.orderNumber}</Ltr>
        </h1>
        <StatusChip
          tone={JOB_TONE[job.status] ?? "neutral"}
          label={j(`status.${job.status as "QC_PENDING"}`)}
        />
        {job.attemptNo > 1 && <Badge tone="warning">{j("attempt", { n: job.attemptNo })}</Badge>}
        {first?.material && (
          <span className="ms-auto text-sm text-text-secondary">
            {catalogName(first.material.i18n, locale, first.material.code)}
            {first.variant &&
              ` · ${catalogName(first.variant.i18n, locale, first.variant.colorCode)}`}{" "}
            · ×{first.item.quantity}
          </span>
        )}
      </div>

      {!evidence ? (
        <Banner tone="info">{t("noEvidence")}</Banner>
      ) : (
        <Card className="flex flex-col gap-6">
          <SectionTitle>{t("evidence")}</SectionTitle>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {evidence.photoFileIds.map((id, i) => (
              <li key={id}>
                <a
                  href={`/api/files/${id}?purpose=qc_review`}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square overflow-hidden rounded-s border border-border-subtle bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimizable */}
                  <img
                    src={`/api/files/${id}?purpose=qc_review`}
                    alt={j("photoAlt", { n: i + 1 })}
                    className="size-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
          <table className="w-full text-sm">
            <caption className="sr-only">{t("measured")}</caption>
            <thead>
              <tr className="text-start text-xs text-text-secondary">
                <th scope="col" className="py-2 text-start">
                  {t("axis")}
                </th>
                <th scope="col" className="py-2 text-end">
                  {t("expected")}
                </th>
                <th scope="col" className="py-2 text-end">
                  {t("measured")}
                </th>
                <th scope="col" className="py-2 text-end" />
              </tr>
            </thead>
            <tbody>
              {evidence.measurements.map((m) => {
                const ok =
                  m.measuredMm !== undefined &&
                  Math.abs(m.measuredMm - m.expectedMm) <= m.toleranceMm;
                return (
                  <tr key={m.name} className="border-t border-border-subtle">
                    <th scope="row" className="py-2 text-start font-medium">
                      {m.name.toUpperCase()}
                    </th>
                    <td className="py-2 text-end tabular-nums">
                      <Ltr>
                        {formatNumber(m.expectedMm, locale, 1)} ±{" "}
                        {formatNumber(m.toleranceMm, locale, 2)}
                      </Ltr>
                    </td>
                    <td className="py-2 text-end tabular-nums">
                      {m.measuredMm !== undefined ? formatNumber(m.measuredMm, locale, 2) : "—"}
                    </td>
                    <td className="py-2 text-end">
                      <Badge tone={ok ? "success" : "danger"}>
                        {ok ? t("within") : t("outside")}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(evidence.checklist).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2 text-sm">
                {v ? (
                  <CheckCircle2 aria-hidden className="size-4 text-success" />
                ) : (
                  <XCircle aria-hidden className="size-4 text-danger" />
                )}
                {j(`check.${k as "no_warping"}`)}
                <span className="sr-only">{v ? t("within") : t("outside")}</span>
              </li>
            ))}
          </ul>
          {evidence.notes && (
            <p className="rounded-s bg-surface-sunken p-3 text-sm" dir="auto">
              {evidence.notes}
            </p>
          )}
          {job.status === "QC_PENDING" && (
            <div className="flex flex-wrap gap-3 border-t border-border-subtle pt-4">
              <ActionForm
                action={qcVerdictAction.bind(null, locale, jobId, "pass")}
                submitLabel={t("pass")}
                size="lg"
              />
              <ActionForm
                action={qcVerdictAction.bind(null, locale, jobId, "fail")}
                submitLabel={t("fail")}
                variant="danger-outline"
                size="lg"
                dialogTitle={t("fail")}
                fields={[
                  { name: "defect", label: t("defect"), kind: "select", options: defectOptions },
                  {
                    name: "severity",
                    label: t("severity"),
                    kind: "select",
                    options: (["major", "minor", "critical"] as const).map((v) => ({
                      value: v,
                      label: q(`severity.${v}`),
                    })),
                  },
                  notes,
                ]}
              />
              <ActionForm
                action={qcVerdictAction.bind(null, locale, jobId, "needs_info")}
                submitLabel={t("needsInfo")}
                variant="ghost"
                size="lg"
                dialogTitle={t("needsInfo")}
                fields={[{ ...notes, required: true }]}
              />
            </div>
          )}
        </Card>
      )}

      {job.status === "QC_FAILED" && (
        <Card className="flex flex-col gap-4">
          <SectionTitle>{t("reprint")}</SectionTitle>
          <ActionForm
            action={reprintAction.bind(null, locale, jobId)}
            submitLabel={t("reprint")}
            fields={[
              { name: "reasonCode", label: t("defect"), kind: "select", options: defectOptions },
              {
                name: "costBearer",
                label: t("costBearer"),
                kind: "select",
                options: (["supplier", "platform", "customer"] as const).map((v) => ({
                  value: v,
                  label: q(`costBearer.${v}`),
                })),
              },
              { name: "rootCause", label: t("rootCause"), kind: "textarea" },
            ]}
          />
        </Card>
      )}

      {reviews.length > 0 && (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("history")}</SectionTitle>
          <ul className="flex flex-col gap-2 text-sm">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    r.verdict === "pass" ? "success" : r.verdict === "fail" ? "danger" : "warning"
                  }
                >
                  {r.verdict === "pass"
                    ? t("pass")
                    : r.verdict === "fail"
                      ? t("fail")
                      : t("needsInfo")}
                </Badge>
                {(r.defects ?? []).map((d) => q(`defects.${d.code as "warping"}`)).join(", ")}
                {r.notes && <span className="text-text-secondary">· {r.notes}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
