"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Banner, Button, Dialog, RadioCards } from "@mfg/ui";
import { respondToOfferAction } from "@/app/actions/partner";
import { useErrorMessage } from "@/lib/errors";

const REASONS = ["capacity", "material", "deadline", "other"] as const;

export function OfferActions({ offerId, locale }: { offerId: string; locale: string }) {
  const t = useTranslations("supplier.offer");
  const c = useTranslations("common.actions");
  const errorText = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("capacity");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const respond = (accept: boolean) =>
    start(async () => {
      setError(undefined);
      const r = await respondToOfferAction(locale, offerId, accept, accept ? undefined : reason);
      if (!r.ok) return setError(errorText(r));
      setOpen(false);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-3">
      {error && !open && <Banner tone="danger">{error}</Banner>}
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          loading={pending && !open}
          onClick={() => respond(true)}
          className="flex-1 sm:flex-none"
        >
          {t("accept")}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => setOpen(true)} disabled={pending}>
          {t("decline")}
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("declineTitle")}
        closeLabel={c("cancel")}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {c("cancel")}
            </Button>
            <Button variant="danger" loading={pending} onClick={() => respond(false)}>
              {t("decline")}
            </Button>
          </div>
        }
      >
        {error && <Banner tone="danger">{error}</Banner>}
        <RadioCards
          name={`decline-${offerId}`}
          legend={t("declineTitle")}
          options={REASONS.map((r) => ({ value: r, title: t(`reasons.${r}`) }))}
          value={reason}
          onChange={setReason}
        />
      </Dialog>
    </div>
  );
}
