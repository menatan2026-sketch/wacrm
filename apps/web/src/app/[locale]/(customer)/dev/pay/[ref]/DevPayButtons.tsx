"use client";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@mfg/ui";
import { devPayAction } from "@/app/actions/dev";

export function DevPayButtons({ providerRef, locale, orderId, status }: { providerRef: string; locale: string; orderId: string; status: string }) {
  const t = useTranslations("payments.devPay");
  const [pending, start] = useTransition();
  if (status !== "PENDING") {
    return (
      <a href={`/${locale}/orders/${orderId}`} className="text-primary hover:underline">
        {t("back")}
      </a>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" loading={pending} onClick={() => start(() => devPayAction(providerRef, "approve", locale))}>
        {t("approve")}
      </Button>
      <Button variant="secondary" disabled={pending} onClick={() => start(() => devPayAction(providerRef, "decline", locale))}>
        {t("decline")}
      </Button>
    </div>
  );
}
