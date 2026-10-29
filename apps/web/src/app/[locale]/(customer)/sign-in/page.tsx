import { getTranslations } from "next-intl/server";
import { Card } from "@mfg/ui";
import { SignInForm } from "@/components/SignInForm";
import { resolveLocale } from "@/lib/i18n";

export default async function SignIn({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = await resolveLocale(params);
  const { next } = await searchParams;
  const t = await getTranslations("auth.signIn");
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-14">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-text-secondary">{t("subtitle")}</p>
      </div>
      <Card>
        <SignInForm surface="customer" locale={locale} next={next} />
      </Card>
    </div>
  );
}
