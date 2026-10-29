import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { Surface } from "@mfg/db";
import { Badge, buttonClasses } from "@mfg/ui";
import { signOutAction } from "@/app/actions/auth";
import { BrandMark } from "./BrandMark";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SurfaceNav } from "./SurfaceNav";

/** Header + section nav shared by the partner and ops workspaces. Nav shows only when signed in. */
export async function SurfaceShell({
  surface,
  locale,
  title,
  base,
  nav,
  navLabel,
  userEmail,
  children,
}: {
  surface: Exclude<Surface, "customer">;
  locale: string;
  title: string;
  base: string;
  nav: { href: string; label: string }[];
  navLabel: string;
  userEmail?: string;
  children: ReactNode;
}) {
  const c = await getTranslations("common");
  return (
    <div className="flex min-h-dvh flex-col bg-surface-base">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-raised/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-4 py-2 md:px-8">
          <div className="flex h-12 items-center gap-3">
            <Link
              href={base}
              className="flex items-center gap-3 rounded-s focus-visible:outline-2 focus-visible:outline-focus"
            >
              <BrandMark name={c("brand")} />
              <span className="hidden sm:inline-flex">
                <Badge tone={surface === "admin" ? "signature" : "info"}>{title}</Badge>
              </span>
            </Link>
            <div className="ms-auto flex items-center gap-2">
              {userEmail && (
                <span className="hidden text-sm text-text-secondary lg:inline" dir="ltr">
                  {userEmail}
                </span>
              )}
              <LanguageSwitcher surface={surface} />
              {userEmail && (
                <form action={signOutAction.bind(null, surface, locale)}>
                  <button type="submit" className={buttonClasses("ghost", "sm")}>
                    {c("actions.signOut")}
                  </button>
                </form>
              )}
            </div>
          </div>
          {userEmail && <SurfaceNav items={nav} label={navLabel} base={base} />}
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
