"use client";
import { useTranslations } from "next-intl";
import { Button } from "@mfg/ui";

/** Friendly error boundary: never shows a stack trace; offers retry and a reference code. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <h1 className="text-3xl font-semibold">{t("errorPage.title")}</h1>
      <p className="text-text-secondary">{t("errorPage.body")}</p>
      {error.digest && (
        <p className="text-sm text-text-secondary">
          {t("reference")}: <bdi className="font-mono">{error.digest}</bdi>
        </p>
      )}
      <Button size="lg" onClick={reset}>
        {t("actions.retry")}
      </Button>
    </main>
  );
}
