import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonClasses } from "@mfg/ui";

export default async function NotFound() {
  const t = await getTranslations("common.notFound");
  const locale = await getLocale();
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <p className="font-mono text-sm text-text-tertiary">404</p>
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="text-text-secondary">{t("body")}</p>
      <Link href={`/${locale}`} className={buttonClasses("primary", "lg")}>
        {t("home")}
      </Link>
    </main>
  );
}
