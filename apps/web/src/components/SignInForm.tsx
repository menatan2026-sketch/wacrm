"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Banner, Button, Field, Input } from "@mfg/ui";
import { requestCodeAction, verifyCodeAction } from "@/app/actions/auth";
import { useErrorMessage } from "@/lib/errors";

/** Passwordless email OTP: email → 6-digit code. Shared by all three surfaces. */
export function SignInForm({ surface, locale, next, inviteToken, defaultEmail }: { surface: "customer" | "supplier" | "admin"; locale: string; next?: string; inviteToken?: string; defaultEmail?: string }) {
  const t = useTranslations("auth.signIn");
  const v = useTranslations("validation");
  const errorText = useErrorMessage();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const sendCode = () =>
    start(async () => {
      setError(undefined);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(v("email"));
      const r = await requestCodeAction(email, locale);
      if (!r.ok) return setError(errorText(r));
      setStage("code");
    });
  const verify = () =>
    start(async () => {
      setError(undefined);
      if (!/^\d{6}$/.test(code.trim())) return setError(v("code"));
      const r = await verifyCodeAction({ email, code, surface, locale, next, inviteToken });
      if (r && !r.ok) setError(errorText(r));
    });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (stage === "email") sendCode();
        else verify();
      }}
    >
      {stage === "email" ? (
        <Field label={t("email")} hint={t("emailHint")} error={error}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="email" type="email" autoComplete="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={describedBy} invalid={invalid} />
          )}
        </Field>
      ) : (
        <>
          <Banner tone="info">{t("codeSent", { email })}</Banner>
          <Field label={t("code")} error={error}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} name="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-describedby={describedBy} invalid={invalid} className="font-mono tracking-[0.3em]" />
            )}
          </Field>
        </>
      )}
      <Button type="submit" size="lg" loading={pending}>
        {stage === "email" ? t("sendCode") : t("verify")}
      </Button>
      {stage === "code" && (
        <div className="flex flex-wrap gap-4 text-sm">
          <button type="button" className="text-primary hover:underline" onClick={() => setStage("email")}>
            {t("differentEmail")}
          </button>
          <button type="button" className="text-primary hover:underline" onClick={sendCode}>
            {t("resend")}
          </button>
        </div>
      )}
      <p className="text-xs text-text-secondary">{t("terms")}</p>
    </form>
  );
}
