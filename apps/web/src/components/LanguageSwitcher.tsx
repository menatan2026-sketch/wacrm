"use client";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { LOCALE_NAMES, locales, type AppLocale } from "@mfg/i18n/config";
import { setLocaleAction } from "@/app/actions/preferences";

/** Switches language in place (same page), remembers the choice, and never auto-switches. */
export function LanguageSwitcher({ surface }: { surface: "customer" | "supplier" | "admin" }) {
  const t = useTranslations("common.language");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as AppLocale;
          start(async () => {
            await setLocaleAction(next, surface);
            const rest = pathname.split("/").slice(2).join("/");
            router.replace(`/${next}${rest ? `/${rest}` : ""}${window.location.search}`, {
              scroll: false,
            });
          });
        }}
        className="h-9 rounded-s border border-border-default bg-surface-raised px-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-focus"
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
