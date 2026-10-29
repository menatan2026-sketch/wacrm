import { ChevronRight, Inbox, Wrench } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { production, routing, suppliers } from "@mfg/core";
import { formatDateTime, formatMoney } from "@mfg/i18n";
import {
  Badge,
  Banner,
  buttonClasses,
  Card,
  EmptyState,
  JOB_TONE,
  Ltr,
  SectionTitle,
  StatusChip,
} from "@mfg/ui";
import { isolate, resolveLocale } from "@/lib/i18n";
import { partnerContext } from "@/lib/partner";
import { OfferActions } from "./_components/OfferActions";
import { PartSpec } from "./_components/PartSpec";

export default async function PartnerToday({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { ctx, supplierId } = await partnerContext(locale, `/${locale}/partners`);
  const t = await getTranslations("supplier");
  const [supplier, offers, jobs] = await Promise.all([
    suppliers.getSupplier(ctx, supplierId),
    routing.supplierOffers(ctx, supplierId),
    production.supplierJobs(ctx, supplierId),
  ]);
  const active = jobs.filter((j) => j.job.status !== "HANDED_OFF");
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-8 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">{t("today.title")}</h1>
        <p className="text-text-secondary">{supplier.name}</p>
      </div>
      {supplier.status !== "active" && (
        <Banner
          tone={suppliers.onboardingComplete(supplier) ? "info" : "warning"}
          action={
            !suppliers.onboardingComplete(supplier) && (
              <Link
                href={`/${locale}/partners/profile`}
                className={buttonClasses("secondary", "sm")}
              >
                {t("today.goSetup")}
              </Link>
            )
          }
        >
          {suppliers.onboardingComplete(supplier)
            ? t("profile.waitingActivation")
            : t("today.onboarding")}
        </Banner>
      )}

      <section aria-labelledby="offers-title" className="flex flex-col gap-4">
        <SectionTitle id="offers-title">
          {t("today.offers")} {offers.length > 0 && <Badge tone="signature">{offers.length}</Badge>}
        </SectionTitle>
        {offers.length === 0 ? (
          <EmptyState
            icon={<Inbox aria-hidden className="size-10" strokeWidth={1.25} />}
            title={t("today.noOffers")}
            body={t("today.noOffersBody")}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {offers.map(({ offer, job, order, part }) => (
              <li key={offer.id}>
                <Card className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">
                        <Ltr mono>{order.orderNumber}</Ltr>
                      </span>
                      <span className="text-sm text-text-secondary">
                        {t("offer.expires", {
                          time: isolate(formatDateTime(offer.expiresAt, locale)),
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.urgencyTier !== "standard" && (
                        <Badge tone="warning">{t("offer.urgent")}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
                    <div className="flex flex-col">
                      <span className="text-sm text-text-secondary">{t("offer.payout")}</span>
                      <span className="text-3xl font-semibold tabular-nums">
                        {formatMoney(offer.payoutMinor, job.currency, locale)}
                      </span>
                      {job.dueAt && (
                        <span className="text-sm text-text-secondary">
                          {t("offer.due")}: {formatDateTime(job.dueAt, locale)}
                        </span>
                      )}
                    </div>
                    <PartSpec part={part} locale={locale} />
                  </div>
                  <OfferActions offerId={offer.id} locale={locale} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="jobs-title" className="flex flex-col gap-4">
        <SectionTitle id="jobs-title">{t("today.jobs")}</SectionTitle>
        {active.length === 0 ? (
          <EmptyState
            icon={<Wrench aria-hidden className="size-10" strokeWidth={1.25} />}
            title={t("today.noJobs")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map(({ job, orderNumber, part }) => (
              <li key={job.id}>
                <Link
                  href={`/${locale}/partners/jobs/${job.id}`}
                  className="flex flex-col gap-3 rounded-m border border-border-subtle bg-surface-raised p-4 shadow-raised transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <span className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium">
                      <Ltr mono>{orderNumber}</Ltr>
                      {job.attemptNo > 1 && (
                        <Badge tone="warning">{t("job.attempt", { n: job.attemptNo })}</Badge>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusChip
                        tone={JOB_TONE[job.status] ?? "neutral"}
                        label={t(`job.status.${job.status as "ACCEPTED"}`)}
                        size="sm"
                      />
                      <ChevronRight
                        aria-hidden
                        className="size-4 text-text-tertiary rtl:rotate-180"
                      />
                    </span>
                  </span>
                  <PartSpec part={part} locale={locale} />
                  {job.dueAt && (
                    <span className="text-sm text-text-secondary">
                      {t("offer.due")}: {formatDateTime(job.dueAt, locale)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
