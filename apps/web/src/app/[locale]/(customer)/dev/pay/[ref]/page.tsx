import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isFakePaymentProvider, payments } from "@mfg/core";
import { formatMoney } from "@mfg/i18n";
import { Banner, Card } from "@mfg/ui";
import { useLocaleParam } from "@/lib/i18n";
import { deps } from "@/lib/platform";
import { DevPayButtons } from "./DevPayButtons";

/** Hosted-payment-page simulator for the fake PSP (never available with a real provider). */
export default async function DevPayPage({ params }: { params: Promise<{ locale: string; ref: string }> }) {
  const locale = await useLocaleParam(params);
  const { ref } = await params;
  const d = deps();
  if (!isFakePaymentProvider(d.payments)) notFound();
  const payment = await payments.findPaymentByRef(d, ref);
  if (!payment) notFound();
  const t = await getTranslations("payments.devPay");
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-14">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Banner tone="warning">{t("notice")}</Banner>
      <Card className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <span className="text-text-secondary">{t("amount")}</span>
          <span className="text-3xl font-medium tabular-nums">{formatMoney(payment.amountMinor, payment.currency, locale)}</span>
        </div>
        <DevPayButtons providerRef={ref} locale={locale} orderId={payment.orderId} status={payment.status} />
      </Card>
    </div>
  );
}
