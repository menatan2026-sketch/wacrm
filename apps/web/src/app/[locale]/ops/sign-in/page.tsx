import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@mfg/ui";
import { SignInForm } from "@/components/SignInForm";
import { useLocaleParam } from "@/lib/i18n";
import { getActor } from "@/lib/session";

export default async function OpsSignIn({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const locale = await useLocaleParam(params);
  const { next } = await searchParams;
  if (await getActor("admin")) redirect(`/${locale}/ops`);
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-14">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t("staff.title")}</h1>
        <p className="text-text-secondary">{t("signIn.subtitle")}</p>
      </div>
      <Card>
        <SignInForm surface="admin" locale={locale} next={next} />
      </Card>
    </div>
  );
}
