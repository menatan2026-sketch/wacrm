"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button, Field, Input } from "@mfg/ui";
import { verifyMfaAction } from "@/app/actions/auth";
import { useErrorMessage } from "@/lib/errors";

export function MfaForm({ locale, secret }: { locale: string; secret?: string }) {
  const t = useTranslations("auth.mfa");
  const v = useTranslations("validation");
  const errorText = useErrorMessage();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(undefined);
          if (!/^\d{6}$/.test(code)) return setError(v("code"));
          const r = await verifyMfaAction(code, locale);
          if (r && !r.ok) setError(errorText(r));
        });
      }}
    >
      {secret && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("secret")}</span>
          <code dir="ltr" className="break-all rounded-s bg-surface-sunken p-3 font-mono text-sm tracking-wider" data-testid="mfa-secret">
            {secret.match(/.{1,4}/g)?.join(" ")}
          </code>
        </div>
      )}
      <Field label={t("enter")} error={error}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-describedby={describedBy} invalid={invalid} className="font-mono tracking-[0.3em]" />
        )}
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {t("verify")}
      </Button>
    </form>
  );
}
