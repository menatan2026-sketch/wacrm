import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@mfg/core";
import { Card } from "@mfg/ui";
import { resolveLocale } from "@/lib/i18n";
import { deps } from "@/lib/platform";
import { getActor } from "@/lib/session";
import { MfaForm } from "./MfaForm";

export default async function MfaPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const actor = await getActor("admin");
  if (!actor) redirect(`/${locale}/ops/sign-in`);
  if (actor.mfaVerified) redirect(`/${locale}/ops`);
  const t = await getTranslations("auth.mfa");
  const enrolled = await auth.mfaEnrolled(deps(), actor);
  // Enrollment starts on the server, once per page load, so the key shown is always the one stored.
  const setup = enrolled ? null : await auth.startMfaEnrollment(deps(), actor);
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-14">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{enrolled ? t("title") : t("setupTitle")}</h1>
        <p className="text-text-secondary">{enrolled ? t("enter") : t("setupBody")}</p>
      </div>
      <Card>
        <MfaForm locale={locale} secret={setup?.secret} />
      </Card>
    </div>
  );
}
