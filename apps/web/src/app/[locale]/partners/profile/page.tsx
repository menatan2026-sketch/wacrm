import { CheckCircle2, Circle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { catalog, suppliers } from "@mfg/core";
import { Banner, Card, SectionTitle } from "@mfg/ui";
import { catalogName, resolveLocale } from "@/lib/i18n";
import { partnerContext } from "@/lib/partner";
import { ProfileClient } from "./ProfileClient";

const ITEMS = ["company", "location", "machines", "payout", "agreement"] as const;

export default async function PartnerProfile({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { ctx, supplierId } = await partnerContext(locale, `/${locale}/partners/profile`);
  const t = await getTranslations("supplier.profile");
  const [supplier, machines, materials] = await Promise.all([
    suppliers.getSupplier(ctx, supplierId),
    suppliers.listMachines(ctx, supplierId),
    catalog.listMaterials(ctx),
  ]);
  const onboarding = supplier.onboarding as Record<(typeof ITEMS)[number], boolean>;
  const variants = materials.flatMap((m) =>
    m.variants.map((v) => ({
      id: v.id,
      label: `${catalogName(m.i18n, locale, m.code)} · ${catalogName(v.i18n, locale, v.colorCode)}`,
      colorHex: v.colorHex,
    })),
  );
  return (
    <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-8 md:px-8 lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-32 lg:self-start">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("checklist")}</SectionTitle>
          <ul className="flex flex-col gap-2">
            {ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                {onboarding[item] ? (
                  <CheckCircle2 aria-hidden className="size-5 text-success" />
                ) : (
                  <Circle aria-hidden className="size-5 text-text-tertiary" />
                )}
                <span className={onboarding[item] ? "text-text-primary" : "text-text-secondary"}>
                  {t(`items.${item}`)}
                </span>
                <span className="sr-only">{onboarding[item] ? t("accepted") : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
        {supplier.status === "onboarding" && suppliers.onboardingComplete(supplier) && (
          <Banner tone="success">{t("waitingActivation")}</Banner>
        )}
      </aside>
      <ProfileClient
        locale={locale}
        profile={{
          name: supplier.name,
          legalName: supplier.legalName ?? "",
          taxId: supplier.taxId ?? "",
          phone: supplier.phone ?? "",
          city: supplier.city ?? "",
          addressLine: supplier.addressLine ?? "",
          leadTimeDays: supplier.leadTimeDays ?? 3,
        }}
        machines={machines.map((m) => ({
          id: m.id,
          name: m.name,
          build: [m.buildXMm, m.buildYMm, m.buildZMm],
          dailyCapacityMinutes: m.dailyCapacityMinutes,
          materialVariantIds: m.materialVariantIds,
        }))}
        variants={variants}
        hasPayout={Boolean(supplier.payoutDetails)}
        agreementAccepted={Boolean(supplier.agreementAcceptedAt)}
      />
    </div>
  );
}
