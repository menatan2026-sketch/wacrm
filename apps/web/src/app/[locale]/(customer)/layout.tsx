import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { buttonClasses } from "@mfg/ui";
import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { resolveLocale } from "@/lib/i18n";
import { getActor } from "@/lib/session";

export default async function CustomerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("navigation.customer");
  const c = await getTranslations("common");
  const actor = await getActor("customer");
  const base = `/${locale}`;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-base/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 md:px-8">
          <Link
            href={base}
            className="rounded-s focus-visible:outline-2 focus-visible:outline-focus"
          >
            <BrandMark name={c("brand")} />
          </Link>
          <nav aria-label={t("main")} className="ms-auto flex items-center gap-1 sm:gap-3">
            <span className="hidden sm:inline">
              <Link href={`${base}/orders`} className={buttonClasses("ghost", "sm")}>
                {t("orders")}
              </Link>
            </span>
            {actor ? (
              <Link href={`${base}/account`} className={buttonClasses("ghost", "sm")}>
                {t("account")}
              </Link>
            ) : (
              <Link href={`${base}/sign-in`} className={buttonClasses("ghost", "sm")}>
                {t("signIn")}
              </Link>
            )}
            <LanguageSwitcher surface="customer" />
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border-subtle bg-surface-raised">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-8 text-sm text-text-secondary md:flex-row md:items-center md:justify-between md:px-8">
          <p>{c("footer.rights", { year: new Date().getFullYear() })}</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {(["terms", "privacy", "accessibility", "restricted", "shipping"] as const).map(
              (slug) => (
                <Link
                  key={slug}
                  href={`${base}/legal/${slug}`}
                  className="hover:text-text-primary hover:underline"
                >
                  {c(`footer.${slug}`)}
                </Link>
              ),
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
