import { Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { payouts } from "@mfg/core";
import { formatDate, formatMoney } from "@mfg/i18n";
import { Badge, EmptyState, KpiTile, SectionTitle } from "@mfg/ui";
import { useLocaleParam } from "@/lib/i18n";
import { partnerContext } from "@/lib/partner";

export default async function PartnerPayouts({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await useLocaleParam(params);
  const { ctx, supplierId } = await partnerContext(locale, `/${locale}/partners/payouts`);
  const t = await getTranslations("supplier.payouts");
  const { pendingMinor, balanceMinor, statements } = await payouts.supplierBalance(ctx, supplierId);
  const currency = statements[0]?.currency ?? "ILS";
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-8 px-4 py-8 md:px-8">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiTile label={t("balance")} value={formatMoney(balanceMinor, currency, locale)} />
        <KpiTile label={t("pending")} value={formatMoney(pendingMinor, currency, locale)} />
      </div>
      <section aria-labelledby="statements" className="flex flex-col gap-4">
        <SectionTitle id="statements">{t("statements")}</SectionTitle>
        {statements.length === 0 ? (
          <EmptyState icon={<Receipt aria-hidden className="size-10" strokeWidth={1.25} />} title={t("noStatements")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle rounded-m border border-border-subtle bg-surface-raised">
            {statements.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm">
                  {formatDate(s.periodStart, locale)} – {formatDate(s.periodEnd, locale)}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium tabular-nums">{formatMoney(s.totalMinor, s.currency, locale)}</span>
                  {s.status === "paid" && s.paidAt ? <Badge tone="success">{t("paid", { date: formatDate(s.paidAt, locale) })}</Badge> : <Badge tone="warning">{t("closed")}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
