"use client";
import { useTranslations } from "next-intl";

/** Map an action error code to a translated, user-safe message. Unknown codes never leak. */
export function useErrorMessage() {
  const t = useTranslations("errors");
  return (result: { code: string; ref?: string; details?: Record<string, unknown> } | null | undefined) => {
    if (!result) return undefined;
    const key = result.code;
    const max = typeof result.details?.max === "number" ? `${Math.round(result.details.max / 1048576)} MB` : "";
    if (t.has(key)) return t(key, { ref: result.ref ?? "—", max });
    return t("common.unexpected", { ref: result.ref ?? "—" });
  };
}
