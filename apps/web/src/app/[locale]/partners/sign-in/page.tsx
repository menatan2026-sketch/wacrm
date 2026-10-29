import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@mfg/ui";
import { SignInForm } from "@/components/SignInForm";
import { resolveLocale } from "@/lib/i18n";
import { getActor } from "@/lib/session";

export default async function PartnerSignIn({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = await resolveLocale(params);
  const { next } = await searchParams;
  if (await getActor("supplier")) redirect(`/${locale}/partners`);
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-14">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t("staff.partnerTitle")}</h1>
        <p className="text-text-secondary">{t("signIn.subtitle")}</p>
      </div>
      <Card>
        <SignInForm surface="supplier" locale={locale} next={next} />
      </Card>
    </div>
  );
}
