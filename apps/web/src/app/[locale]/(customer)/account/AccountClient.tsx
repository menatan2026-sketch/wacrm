"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, RadioCards } from "@mfg/ui";
import { signOutAction } from "@/app/actions/auth";
import { setMotionAction } from "@/app/actions/preferences";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function AccountPreferences({ motion }: { motion: "system" | "reduced" | "full" }) {
  const t = useTranslations("customer.account");
  const router = useRouter();
  const [value, setValue] = useState(motion);
  const [, start] = useTransition();
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="font-semibold">{t("language")}</span>
        <LanguageSwitcher surface="customer" />
      </div>
      <RadioCards
        name="motion"
        legend={t("motion")}
        columns={3}
        value={value}
        onChange={(v) => {
          setValue(v);
          start(async () => {
            await setMotionAction(v);
            router.refresh();
          });
        }}
        options={[
          { value: "system", title: t("motionSystem") },
          { value: "reduced", title: t("motionReduced") },
          { value: "full", title: t("motionFull") },
        ]}
      />
    </Card>
  );
}

export function SignOutButton({ locale }: { locale: string }) {
  const t = useTranslations("common.actions");
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      className="self-start"
      loading={pending}
      onClick={() => start(() => signOutAction("customer", locale))}
    >
      {t("signOut")}
    </Button>
  );
}
